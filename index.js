// What to visualize?
// - Bar chart of aggregated stats
// - Weekly calendar
// - Monthly calendar with daily bar charts / pie charts
// - Weekly bar charts?

const WIDTH = 1800;
const HEIGHT = 300;

const DATA_FILE = '/data/report-16-11-2020.csv';

const MS_PER_DAY = 86400000;

var tooltip = null;

function millisToDays(ms) {
    return Math.floor(ms / MS_PER_DAY);
}

async function fetchData(url) {
    let resp = await fetch(url);
    return  await resp.text(); 
}

// https://weeknumber.net/how-to/javascript
// Returns the ISO week of the date.
Date.prototype.getWeek = function() {
  var date = new Date(this.getTime());
  date.setHours(0, 0, 0, 0);
  // Thursday in current week decides the year.
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  // January 4 is always in week 1.
  var week1 = new Date(date.getFullYear(), 0, 4);
  // Adjust to Thursday in week 1 and count number of weeks from date to week1.
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000
                        - 3 + (week1.getDay() + 6) % 7) / 7);
}

// Parse a duration (e.g. 01:14) into a floating point value
function parseDuration(strDur) {
    let parts = strDur.split(':');
    let hour = +parts[0];
    let min = (+parts[1]) / 60;
    return hour + min;
}

function getDailyDurations(datesInOrder) {
    let minDate = datesInOrder[0].end;
    let maxDate = datesInOrder[datesInOrder.length - 1].end;

    let totalDays = millisToDays(maxDate.valueOf() - minDate.valueOf());
    let dayOffset = minDate.getDay();

    // Populate all the dates
    let datesDurations = new Map();
    let currentDate = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());

    // Populate blanks prior to the start date
    let beginDate = currentDate - dayOffset * MS_PER_DAY;
    for (let i = 0; i < dayOffset; i++) {
        datesDurations.set(beginDate.valueOf(), null);

        // Increment by one day
        beginDate = new Date(beginDate.valueOf() + MS_PER_DAY);
        beginDate.setHours(0);
        beginDate.setMinutes(0);
    }
    for (let i = 0; i < totalDays; i++) {
        datesDurations.set(currentDate.valueOf(), null);

        // Increment by one day
        currentDate = new Date(currentDate.valueOf() + MS_PER_DAY);
        currentDate.setHours(0);
        currentDate.setMinutes(0);
    }

    for (const activity of datesInOrder) {
        // Take the end time as the "time point" for the activity
        let endDate = new Date(
            activity.end.getFullYear(),
            activity.end.getMonth(),
            activity.end.getDate(),
        ).valueOf();

        let currentDuration = datesDurations.get(endDate);
        if (currentDuration) {
            datesDurations.set(endDate, currentDuration + activity.duration);
        } else {
            datesDurations.set(endDate, activity.duration);
        }
    }

    let durations = new Array(...datesDurations.values());
    let dates = new Array(...datesDurations.keys()).map((d) => new Date(d));

    let zipped = [];
    for (let index in durations) {
        if (durations[index] != null) {
            let entry = {
                duration: durations[index],
                date: dates[index],
            };
            zipped.push(entry);
        }
    }
    return zipped;
}

function getWeeklyDurations(datesInOrder) {
    let dailyDurations = getDailyDurations(datesInOrder);

    // Condense daily durations to weekly
    let weekDuration = 0.0;
    let weekStartDate = dailyDurations[0].date;
    let currentWeek = weekStartDate.getWeek();
    let entries = [];
    for (let element of dailyDurations) {
        weekDuration += element.duration;
        let week = element.date.getWeek();
        if (week > currentWeek) {
            // It's a new week
            entries.push({
                date: weekStartDate,
                duration: weekDuration,
            });
            weekStartDate = element.date;
            weekDuration = 0.0;
            currentWeek = week;
        }
    }
    return entries;
}

// Make a GitHub commit-history style weekly grid from `start` date to `end`
// date
function makeCalendarWeeklyGrid(data) {
    // Process the data
    let datesInOrder = data.sort((a, b) => a.end - b.end);
    let minDate = datesInOrder[0].end;
    let maxDate = datesInOrder[datesInOrder.length - 1].end;
    let totalDays = millisToDays(maxDate.valueOf() - minDate.valueOf());
    let totalWeeks = Math.round(totalDays / 7);

    let dailyDurations = getDailyDurations(datesInOrder);
    let dates = dailyDurations.dates;
    let activities = dailyDurations.activities;

    // Display the grid
    const gridMargin = 40;

    const dayWidth = 20;
    const dayMargin = 10;
    const daySize = dayWidth + dayMargin;

    const tooltipOffset = 15;

    let grid = d3.select('#calendar-grid')
        .attr('width', WIDTH)
        .attr('height', HEIGHT)

    let colorScale = d3.scaleLinear()
        .domain(d3.extent(activities))
        .interpolate(d => d3.interpolateBlues);

    let xScale = d3.scaleTime()
        .domain([minDate, maxDate])
        .range([0, daySize * totalWeeks]);

    let yScale = d3.scalePoint()
        .domain(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', ''])
        .rangeRound([0, daySize * 7]);

    let xAxis = d3.axisBottom()
        .scale(xScale);
    let yAxis = d3.axisLeft()
        .scale(yScale);
    
    let container = grid.append('g')
        .attr('class', 'grid-container')
        .attr('transform', `translate(${gridMargin}, ${gridMargin / 2})`);

    container.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0, ${daySize * 7})`)
        .call(xAxis.ticks(null, "%d"));
    container.append('g')
        .attr('class', 'axis')
        .call(yAxis);

    container.selectAll('.calendar-grid-day')
        .data(activities)
        .enter().append('rect')
        .attr('class', 'calendar-grid-day')
        .attr('width', dayWidth)
        .attr('height', dayWidth)
        .style('fill', (d, i) => {
            if (d) {
                return colorScale(d);
            } else {
                return 'gray';
            }
        })
        .attr('transform', (_d, i) => {
            let x = parseInt(i / 7) * daySize;
            let y = (i % 7) * daySize;
            return `translate(${x}, ${y})`;
        })
        .on('mouseover', (d, i) => {
            if (d) {
                tooltip.html(`${d.toFixed(1)} Hours<br>${dates[i].toLocaleDateString('en-US')}`);
            } else {
                tooltip.html(`No data:<br>${dates[i].toLocaleDateString('en-US')}`)
            }
            return tooltip.style('visibility', 'visible');
        })
        .on("mousemove", () => {
            return tooltip.style("top", (d3.event.pageY-tooltipOffset)+"px").style("left",(d3.event.pageX+tooltipOffset)+"px");
        }) 
        .on("mouseout", () => {
            return tooltip.style("visibility", "hidden");
        });
}

function makeGroupsLineChart(groups, data, colors) {
    // Process the data
    let datesInOrder = data.sort((a, b) => a.end - b.end);
    let minDate = datesInOrder[0].end;
    let maxDate = datesInOrder[datesInOrder.length - 1].end;

    let groupNames = Object.keys(groups);
    let groupData = groupNames.map((g, i) => getGroupData(g, groups, data));
    // let groupDaily = groupData.map((g) => getDailyDurations(g));
    let groupWeekly = groupData.map((g) => getWeeklyDurations(g));

    const margin = 20;

    let chart = d3.select('#groups-chart')
        .attr('width', WIDTH)
        .attr('height', HEIGHT)

    let xScale = d3.scaleTime()
        .domain([minDate, maxDate])
        .range([margin, WIDTH - margin * 2])

    // Assume the first length is the same as the rest
    // let columnWidth = ((WIDTH - margin * 2) / groupWeekly[0].length) / groupWeekly.length;
    let columnWidth = 5;

    let allHours = groupWeekly.map((g) => g.map((e) => +e.duration));
    let maxHours = allHours.reduce((wr, wArr) => {
        let hours = wArr.reduce((r, x) => x > r ? x : r, 0);
        if (hours > wr) {
            return hours;
        } else {
            return wr;
        }
    }, 0);
    let yScale = d3.scaleLinear()
        .domain([0, maxHours])
        .range([HEIGHT - margin * 2, 0]);
    console.log(yScale(60.6));

    chart.append('g')
        .attr('transform', `translate(0, ${HEIGHT - margin * 2})`)
        .call(d3.axisBottom(xScale));
    chart.append('g')
        .call(d3.axisLeft(yScale))
        .attr('transform', `translate(${margin}, 0)`);

    for (let groupIndex in groupWeekly) {
        let group = chart.append('g').attr('class', 'group');
        // group.selectAll('.dot')
        //     .data(groupDaily[groupIndex])
        //     .enter()
        //     .append('circle')
        //         .attr('class', 'dot')
        //         .attr('cx', (d, i) => xScale(d.date))
        //         .attr('cy', (d, i) => yScale(d.duration))
        //         .attr('r', 1.5)
        //         .style('fill', colors[groupIndex])

        // chart.append('path')
        //     .datum(groupWeekly[groupIndex])
        //     .attr('fill', 'none')
        //     .attr('stroke', colors[groupIndex])
        //     .attr('stroke-width', 1.5)
        //     .attr('d', d3.line()
        //         .x((d) => xScale(d.date))
        //         .y((d) => yScale(d.duration))
        //     )
        group.selectAll('.bar')
            .data(groupWeekly[groupIndex])
            .enter()
            .append('rect')
                .attr('class', 'bar')
                .attr('x', (d) => xScale(d.date) + 2 * columnWidth * (groupIndex / (groupWeekly.length / 2)))
                .attr('y', (d) => yScale(d.duration))
                .attr('width', columnWidth)
                .attr('height', (d) => HEIGHT - margin * 2 - yScale(d.duration))
                .style('fill', colors[groupIndex])
    }
    // let container = grid.append('g')
    //     .attr('class', 'grid-container')
    //     .attr('transform', `translate(${gridMargin}, ${gridMargin / 2})`);

    // chart.append('g')
    //     .attr('class', 'axis')
    //     .attr('transform', `translate(0, ${HEIGHT - margin * 2})`)
    //     .call(xAxis.ticks(null, "%d"));
    // chart.append('g')
    //     .attr('class', 'axis')
    //     .call(yAxis);
}

function setTitle(t) {
    document.getElementById('activity-label').innerText = t;
}

function getGroupData(groupName, groups, data) {
    return data.filter((d) => {
        let activities = groups[groupName];
        return activities.some((act) => d.activity == act);
    });
}

function init() {
    let colors = ['#B5CDF8', '#CDF8B5', '#F3ECEE'];
    let groups = {
        'Work': [
            'Meeting',
            'Research ABR',
            'Research Other',
            'Research Physicalization',
            'Research',
            'Teaching',
            'Teaching Prep',
            'Grading',
            'Prelim',
            'IVLab Website',
            'VIS2020 Prep',
        ],
        'Relax': [
            'Family time',
            'Read',
            'Entertainment',
            'Hang out with friends',
            'Recreational Programming',
            'Exercise',
        ],
        'Sleep': ['Sleep'],
    };

    // https://chartio.com/resources/tutorials/how-to-show-data-on-mouseover-in-d3js/
    tooltip = d3.select("body")
        .append("div")
        .style("position", "absolute")
        .style("z-index", "10")
        .style("visibility", "hidden")
        .style("background", "#fff")
        .style('opacity', 0.8)
        .text("a simple tooltip");

    fetchData(DATA_FILE).then((dataStr) => {
        let data = d3.csvParse(dataStr, function(d) {
            let start = new Date(d.From);
            let end = new Date(d.To);
            if (!isNaN(start.valueOf()) && !isNaN(end.valueOf())) {
                return {
                    start: new Date(d.From),
                    end: new Date(d.To),
                    duration: parseDuration(d.Duration),
                    activity: d['Activity type'],
                }
            }
        });

        d3.select('#group-list')
            .selectAll('li')
            .data(Object.keys(groups))
            .enter().append('li')
                .append('p')
                    .text((d, _i) => d)
                    .style('background-color', (_d, i) => colors[i])
                    // .on('click', (name) => {
                    //     setTitle(name);
                    //     let filtered = getGroupData(name, groups, data);
                    //     d3.selectAll('.grid-container').remove();
                    //     // makeCalendarWeeklyGrid(filtered);
                    // });

        let activityTypes = new Set(data.map((a) => a.activity));
        activityTypes = new Array(...activityTypes);
        d3.select('#activity-list')
            .selectAll('li')
            .data(activityTypes)
            .enter().append('li')
                .append('p')
                    .text((d, _i) => d)
                    // .on('click', (name) => {
                    //     setTitle(name);
                    //     let filtered = data
                    //         .filter((d) => d.activity == name);
                    //     d3.selectAll('.grid-container').remove();
                    //     // makeCalendarWeeklyGrid(filtered);
                    // });

        // Default to 'Sleep'
        // let dflt = 'Sleep';
        // setTitle(dflt);
        // let filtered = data
        //     .filter((d) => d.activity == dflt);
        // makeCalendarWeeklyGrid(filtered);
        makeGroupsLineChart(groups, data, colors);
    });
}

window.onload = init;