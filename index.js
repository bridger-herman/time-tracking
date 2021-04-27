// What to visualize?
// - Bar chart of aggregated stats
// - Weekly calendar
// - Monthly calendar with daily bar charts / pie charts
// - Weekly bar charts?

const WIDTH = 1800;
const HEIGHT = 600;

const DATA_FILE = '/data/report-27-04-2021.csv';

const MS_PER_DAY = 86400000;
const WEEKS_PER_YEAR = 52;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

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

// https://stackoverflow.com/a/22859920
Date.prototype.weeksBetween = function(d2) {
    return Math.round((this - d2) / MS_PER_WEEK);
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
    let startDate = dailyDurations[0].date;

    // Condense daily durations to weekly
    let weekDuration = 0.0;
    let weekStartDate = dailyDurations[0].date;

    weekStartDate = makeDateMonday(weekStartDate);

    // let currentWeek = weekStartDate.getWeek();
    let currentWeek = weekStartDate.weeksBetween(startDate);
    let entries = [];
    for (let element of dailyDurations) {
        weekDuration += element.duration;
        // let week = element.date.getWeek();
        let week = element.date.weeksBetween(startDate);
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

// Get weekly durations as a [{'group1': 45.5, 'group2': 93.3}]
function getWeeklyData(datesInOrder, groups) {
    let start = datesInOrder[0].end;
    let end = datesInOrder[datesInOrder.length - 1].end;
    let endWeeksFromStart = end.weeksBetween(start);

    let groupNames = Object.keys(groups);

    // Populate the blank data
    let weeklyData = new Array(endWeeksFromStart + 1);
    for (let i = 0; i < weeklyData.length; i++) {
        weeklyData[i] = {
            'groups': {},
            'weekStart': Date.now(),
        };
        for (const key of groupNames) {
            weeklyData[i]['groups'][key] = 0.0;
        }
    }

    for (const entry of datesInOrder) {
        let group = whichGroup(entry.activity, groups);
        if (group == null) {
            continue;
        }

        let week = entry.end.weeksBetween(start);
        let weekStart = makeDateMonday(entry.end);
        weeklyData[week]['groups'][group] += entry.duration;
        weeklyData[week]['weekStart'] = weekStart; // Resets this every time even though it's already there after the first one
    }

    return weeklyData;
}

function whichGroup(activity, groups) {
    for (let g in groups) {
        if (groups[g].find(e => e == activity)) {
            return g;
        }
    }
    return null;
}

function makeDateMonday(date) {
    let d = new Date();
    d.setFullYear(date.getFullYear());
    d.setMonth(date.getMonth());
    d.setDate(date.getDate());
    // Make sure week starts on a Monday
    // https://stackoverflow.com/a/11789820
    let startDayOfWeek = d.getDay();
    d.setDate(d.getDate() + (1 - startDayOfWeek));
    return d;
}

function makeGroupsLineChart(groups, data, colors) {
    // Process the data
    let datesInOrder = data.sort((a, b) => a.end - b.end);
    let minDate = datesInOrder[0].end;
    let maxDate = datesInOrder[datesInOrder.length - 1].end;

    // let weeklyData = getWeeklyData(datesInOrder, groups);

    let groupNames = Object.keys(groups);
    let groupData = groupNames.map((g, i) => getGroupData(g, groups, data));
    let groupDaily = groupData.map((g) => getDailyDurations(g));
    let groupWeekly = groupData.map((g) => getWeeklyDurations(g));

    // let groupDuration = groupDaily;
    let groupDuration = groupWeekly;

    const margin = 40;

    let chart = d3.select('#groups-chart')
        .attr('width', WIDTH)
        .attr('height', HEIGHT)

    let xScale = d3.scaleTime()
        .domain([makeDateMonday(minDate), makeDateMonday(maxDate)])
        .range([margin, WIDTH - margin * 2])

    // Assume the first length is the same as the rest
    // let columnWidth = ((WIDTH - margin * 2) / groupWeekly[0].length) / groupWeekly.length;
    let columnWidth = 5;

    // Find the max number of hours per week per group
    let maxHours = 0;
    for (const group of groupDuration) {
        for (const entry of group) {
            if (entry.duration > maxHours) {
                maxHours = entry.duration;
            }
        }
    }

    let yScale = d3.scaleLinear()
        .domain([0, maxHours])
        .range([HEIGHT - margin * 2, 0]);

    chart.append('g')
        .attr('transform', `translate(0, ${HEIGHT - margin * 2})`)
        .call(d3.axisBottom(xScale));
    chart.append('g')
        .call(d3.axisLeft(yScale))
        .attr('transform', `translate(${margin}, 0)`);

    // Stacked Column Chart (try 3)
    // let bars = chart.append('g');
    // bars.selectAll('g')
    //     .data(weeklyData)
    //     .enter().append('g')
    //         .attr('class', 'week')
    //         // .attr('width', columnWidth)
    //         // .attr('height', 10)
    //         .attr('transform', (e) => {
    //             return `translate(${xScale(e.weekStart)}, 0)`;
    //         })
    //         .selectAll('rect')
    //             .data((g) => g.groups)
    //             .append('rect')
    //                 .attr('fill', 'blue')
    //                 .attr('width', columnWidth)
    //                 .attr('height', 10)

    // Stacked Column Chart (try 2)
    // chart.append('g')
    //     .selectAll('g')
    //     .data(weeklyData)
    //     .enter().append('g')
    //         .attr('class', 'week')
    //         .attr('transform', (e) => {
    //             // console.log(e.weekStart);
    //             return `translate(${xScale(e.weekStart)}, 0)`
    //         })
    //         .selectAll('rect')
    //             .attr('fill', 'blue')
    //             .data((d) => d)
    //             .enter().append('rect')
    //                 .attr('width', columnWidth)
    //                 .attr('height', 10)
    //                 .attr('y', (g) => {
    //                     console.log(g);
    //                     return yScale(g['Work']);
    //                 })
    //                 .attr('fill', 'green');

    let prevGroupYMax = 0;
    for (let groupIndex in groupDuration) {
        let group = chart.append('g').attr('class', 'group');
        // Stacked column chart
        // let thisGroupYMax = yScale(eachMax[groupIndex]);
        // group.selectAll('.bar')
        //     .data(groupDuration[groupIndex])
        //     .enter()
        //     .append('rect')
        //         .attr('class', 'bar')
        //         .attr('width', columnWidth)
        //         .attr('height', (d) => HEIGHT - margin * 2 - yScale(d.duration))
        //         .style('fill', colors[groupIndex])
        //         .attr('transform', (d) => `translate(${xScale(d.date)}, ${prevGroupYMax + yScale(d.duration)})`);
        // prevGroupYMax += thisGroupYMax;

        // Dots
        group.selectAll('.dot')
            .data(groupDuration[groupIndex])
            .enter()
            .append('circle')
                .attr('class', 'dot')
                .attr('cx', (d, i) => xScale(d.date))
                .attr('cy', (d, i) => yScale(d.duration))
                .attr('r', 3.0)
                .style('fill', colors[groupIndex])

        // Lines
        chart.append('path')
            .datum(groupWeekly[groupIndex])
            .attr('fill', 'none')
            .attr('stroke', colors[groupIndex])
            .attr('stroke-width', 1.5)
            .attr('d', d3.line()
                .x((d) => xScale(d.date))
                .y((d) => yScale(d.duration))
            )

        // Kinda buggy multi-column chart
        // group.selectAll('.bar')
        //     .data(groupDuration[groupIndex])
        //     .enter()
        //     .append('rect')
        //         .attr('class', 'bar')
        //         // .attr('x', (d) => xScale(d.date) + 2 * columnWidth * (groupIndex / (groupDuration.length / 2)))
        //         .attr('x', (d, i) => {
        //             // console.log(`group: ${groupIndex}, index ${i}`);
        //             // console.log(d.date);
        //             // console.log(xScale(d.date) + 2 * columnWidth * (groupIndex / (groupDuration.length / 2)));
        //             return xScale(d.date) + 2 * columnWidth * (groupIndex / (groupDuration.length / 2));
        //         })
        //         .attr('y', (d) => yScale(d.duration))
        //         .attr('width', columnWidth)
        //         .attr('height', (d) => HEIGHT - margin * 2 - yScale(d.duration))
        //         .style('fill', colors[groupIndex])
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
    let colors = ['#189A91', '#4632C4', '#F3ECEE'];
    // let colors = ['#ff0000', '#00ff00', '#0000ff'];
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