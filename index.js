// What to visualize?
// - Bar chart of aggregated stats
// - Weekly calendar
// - Monthly calendar with daily bar charts / pie charts
// - Weekly bar charts?

const WIDTH = 960;
const HEIGHT = 540;

const DATA_FILE = '/data/time_logger_jan-mar-2020.csv';

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
    let minFirst = data.sort((a, b) => a.end - b.end);
    let minDate = minFirst[0].end;
    let maxDate = minFirst[minFirst.length - 1].end;

    let totalDays = (maxDate.valueOf() - minDate.valueOf()) / 1000 / 60 / 60 / 24;
    let totalWeeks = Math.round(totalDays / 7);

    let dayOffset = minDate.getDay();
    let durations = [];
    let seenDates = new Set();
    for (const activity of minFirst) {
        // Take the end time as the "time point"
        let endDate = new Date(
            activity.end.getYear(),
            activity.end.getMonth(),
            activity.end.getDate(),
        );

        if (seenDates.has(endDate)) {
            durations[seenDates.size + dayOffset] += activity.duration;
        } else {
            seenDates.add(endDate);
            durations[seenDates.size + dayOffset] = activity.duration;
        }
    }

    // Display the grid
    const gridMargin = 40;

    const dayWidth = 20;
    const dayMargin = 10;
    const daySize = dayWidth + dayMargin;

    let grid = d3.select('#calendar-grid')
        .attr('width', WIDTH)
        .attr('height', HEIGHT)

    let colorScale = d3.scaleLinear()
        .domain(d3.extent(durations))
        .interpolate(d => d3.interpolateBlues);

    let xScale = d3.scaleLinear()
        .domain([0, totalWeeks])
        .range([0, daySize * totalWeeks]);
    let yScale = d3.scalePoint()
        .domain(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
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
        .call(xAxis);
    container.append('g')
        .attr('class', 'axis')
        .call(yAxis);

    container.selectAll('.calendar-grid-day')
        .data(durations)
        .enter().append('rect')
        .attr('class', 'calendar-grid-day')
        .attr('width', dayWidth)
        .attr('height', dayWidth)
        .style('fill', (d, i) => {
            if (d) {
                return colorScale(d)
            } else {
                return 'green';
            }
        })
        .attr('transform', (_d, i) => {
            let x = parseInt((i + dayOffset) / 7) * daySize;
            let y = ((i + dayOffset) % 7) * daySize;
            return `translate(${x}, ${y})`;
        });
}


function init() {
    // makeCalendarWeeklyGrid(10, 10);
    fetchData(DATA_FILE).then((dataStr) => {
        let data = d3.csvParse(dataStr, function(d) {
            return {
                start: new Date(d.From),
                end: new Date(d.To),
                duration: parseDuration(d.Duration),
                activity: d['Activity type'],
            }
        });

        let filtered = data
            .filter((d) => d.activity == 'Sleep');
        makeCalendarWeeklyGrid(filtered);
    });
}

function makeDurationBarChart(data) {
    let width = 960;
    let height = 540;
    let barWidth = width / data.length;

    let chart = d3.select('.chart')
        .attr('width', width)
        .attr('height', height);
    
    let x = d3.scaleOrdinal();
        // .rangeRound([0, width], 0.1);

    let y = d3.scaleLinear()
        .domain([0, d3.max(data, (d) => d.duration)])
        .range([height, 0]);

    // let xAxis = d3.axis
    //     .scale(x)
    //     .orient('bottom');

    // let yAxis = d3.axis
    //     .scale(y)
    //     .orient('left');
    
    // chart.append('g')
    //     .attr('class', 'x-axis')
    //     .attr('transform', `translate(0,${height})`)
    //     .call(xAxis);

    // chart.append('g')
    //     .attr('class', 'y-axis')
    //     .call(yAxis);

    chart.selectAll('.bar')
        .data(data)
        .enter().append('rect')
        .attr('class', 'bar')
        .attr('x', (d) => x(d.activity))
        .attr('y', (d) => y(d.duration))
        .attr('height', (d) => height - y(d.duration))
        .attr('width', x.rangeBand())
        // .attr('class', 'bar')
        // .attr('transform', (_d, i) => `translate(${i * barWidth},0)`);

    bar.append('rect')
        .attr('y', (d) => y(d.duration))
        .attr('height', (d) => height - y(d.duration))
        .attr('width', barWidth - 1.0)

    bar.append('text')
        .attr('x', barWidth / 2.0)
        .attr('y', (d) => y(d.duration))
        .attr('dy', '1.0em')
        .text((d) => d.duration.toFixed(0));
}

window.onload = init;