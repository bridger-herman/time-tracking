// What to visualize?
// - Bar chart of aggregated stats
// - Weekly calendar
// - Monthly calendar with daily bar charts / pie charts
// - Weekly bar charts?

const WIDTH = 960;
const HEIGHT = 540;

const DATA_FILE = '/data/report-15-03-2020.csv';

function millis_to_days(ms) {
    return Math.floor(ms / 1000 / 60 / 60 / 24);
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
    let minFirst = data.sort((a, b) => a.end - b.end);
    let minDate = minFirst[0].end;
    let maxDate = minFirst[minFirst.length - 1].end;

    let totalDays = millis_to_days(maxDate - minDate);
    let dayOffset = minDate.getDay();
    let totalWeeks = Math.round(totalDays / 7);

    let activities = new Array(totalDays + dayOffset);

    let seenDates = new Set();
    for (const activity of minFirst) {
        // Take the end time as the "time point"
        let activityDateStr = activity.end.toLocaleDateString('en-US');
        let daysSinceStart = millis_to_days(activity.end - minDate);

        if (seenDates.has(activityDateStr)) {
            activities[daysSinceStart + dayOffset].duration += activity.duration;
        } else {
            seenDates.add(activityDateStr);
            activities[daysSinceStart + dayOffset] = {
                end: activity.end,
                duration: activity.duration,
                daysSinceStart: daysSinceStart,
            };
        }
    }

    // https://chartio.com/resources/tutorials/how-to-show-data-on-mouseover-in-d3js/
    var tooltip = d3.select("body")
        .append("div")
        .style("position", "absolute")
        .style("z-index", "10")
        .style("visibility", "hidden")
        .style("background", "#fff")
        .style('opacity', 0.8)
        .text("a simple tooltip");

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
        .domain(d3.extent(activities.map(d => d.duration)))
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
                return colorScale(d.duration);
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
                tooltip.html(`${d.duration.toFixed(1)} Hours<br>${d.end.toLocaleDateString('en-US')}`);
            } else {
                tooltip.html(`No data: ${i}`)
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

window.onload = init;