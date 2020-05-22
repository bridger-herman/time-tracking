// What to visualize?
// - Bar chart of aggregated stats
// - Weekly calendar
// - Monthly calendar with daily bar charts / pie charts
// - Weekly bar charts?

const WIDTH = 900;
const HEIGHT = 300;

const DATA_FILE = '/data/report-22-05-2020.csv';

const MS_PER_DAY = 86400000;

var tooltip = null;

function millisToDays(ms) {
    return Math.floor(ms / MS_PER_DAY);
}

async function fetchData(url) {
    let resp = await fetch(url);
    return  await resp.text(); 
}

// Parse a duration (e.g. 01:14) into a floating point value
function parseDuration(strDur) {
    let parts = strDur.split(':');
    let hour = +parts[0];
    let min = (+parts[1]) / 60;
    return hour + min;
}

// Make a GitHub commit-history style weekly grid from `start` date to `end`
// date
function makeCalendarWeeklyGrid(data) {
    // Process the data
    let datesInOrder = data.sort((a, b) => a.end - b.end);
    let minDate = datesInOrder[0].end;
    let maxDate = datesInOrder[datesInOrder.length - 1].end;

    let totalDays = millisToDays(maxDate.valueOf() - minDate.valueOf());
    let dayOffset = minDate.getDay();
    let totalWeeks = Math.round(totalDays / 7);

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

    let activities = new Array(...datesDurations.values());
    let dates = new Array(...datesDurations.keys()).map((d) => new Date(d));

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

function makeGroupsLineChart(groups, data) {
    // Process the data
    let datesInOrder = data.sort((a, b) => a.end - b.end);
    let minDate = datesInOrder[0].end;
    let maxDate = datesInOrder[datesInOrder.length - 1].end;

    let groupNames = Object.keys(groups);
    let groupData = groupNames.map((g, i) => getGroupData(g, groups, data));

    const margin = 20;

    let colors = ['steelblue', 'darkred', 'orange'];

    let chart = d3.select('#groups-chart')
        .attr('width', WIDTH)
        .attr('height', HEIGHT)

    let xScale = d3.scaleTime()
        .domain([minDate, maxDate])
        .range([margin, WIDTH - margin * 2])

    let yScale = d3.scaleLinear()
        .domain([0, 12]) // TODO find actual max
        .range([HEIGHT - margin * 2, 0]);

    chart.append('g')
        .attr('transform', `translate(0, ${HEIGHT - margin * 2})`)
        .call(d3.axisBottom(xScale));
    chart.append('g')
        .call(d3.axisLeft(yScale))
        .attr('transform', `translate(${margin}, 0)`);

    for (let i in groupData) {
        chart.append('g')
            .selectAll('dot')
            .data(groupData[i])
            .enter()
            .append('circle')
                .attr('cx', (d) => xScale(d.end))
                .attr('cy', (d) => yScale(d.duration))
                .attr('r', 1.5)
                .style('fill', colors[i])
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
    let groups = {
        'Research': ['Research ABR', 'Research Other', 'Research Physicalization', 'Research'],
        'Relax': ['Family time', 'Read', 'Entertainment', 'Hang out with friends', 'Recreational Programming'],
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
                .append('button')
                    .text((d, _i) => d)
                    .on('click', (name) => {
                        setTitle(name);
                        let filtered = getGroupData(name, groups, data);
                        d3.selectAll('.grid-container').remove();
                        makeCalendarWeeklyGrid(filtered);
                    });

        let activityTypes = new Set(data.map((a) => a.activity));
        activityTypes = new Array(...activityTypes);
        d3.select('#activity-list')
            .selectAll('li')
            .data(activityTypes)
            .enter().append('li')
                .append('button')
                    .text((d, _i) => d)
                    .on('click', (name) => {
                        setTitle(name);
                        let filtered = data
                            .filter((d) => d.activity == name);
                        d3.selectAll('.grid-container').remove();
                        makeCalendarWeeklyGrid(filtered);
                    });

        // Default to 'Sleep'
        let dflt = 'Sleep';
        setTitle(dflt);
        let filtered = data
            .filter((d) => d.activity == dflt);
        makeCalendarWeeklyGrid(filtered);
        makeGroupsLineChart(groups, data);
    });
}

window.onload = init;