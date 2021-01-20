
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