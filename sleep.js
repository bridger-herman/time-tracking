import { Activity } from "./Activity.js";

const WIDTH = 1200;
const HEIGHT = 600;

const DATA_FILE = '/data/report-24-09-2022.csv';
const SLEEP_ACTIVITY = 'Sleep';

async function start() {
    // Load data
    let csvDataText = await fetch(DATA_FILE).then(r => r.text());

    let activities = d3.csvParse(csvDataText, function(d) {
        return Activity.fromTimeLogger(d);
    });


    // Filter by sleep and find "atomic" sleep durations for every day in the
    // duration
    let sleepActivities = activities.filter(a => a.activityType == SLEEP_ACTIVITY);
    let sleepDays = normalizeSleeps(sleepActivities);

    // Sleep deviation from average
    let avg = sleepDays.map(d => d.duration).reduce((x, r) => x + r) / sleepDays.length;
    let sleepDaysAverageDeviation = sleepDays.map(d => {
        if (d.duration !== 'undefined') {
            return {
                deviation: d.duration - avg,
                day: d.day,
            };
        } else {
            return undefined;
        }
    });

    // pixelColumnChart(sleepDaysAverageDeviation);
    pixelColumnChart(sleepDays, 'duration');
}

////////////////////////////////////////////////////////////////////////////////
// Helper functions
////////////////////////////////////////////////////////////////////////////////

function normalizeSleeps(sleepActivities) {
    let startDate = moment(sleepActivities.reduce((a, r) => a.startTime < r.startTime ? a : r).endTime).startOf('day');
    let endDate = moment(sleepActivities.reduce((a, r) => a.endTime > r.endTime ? a : r).endTime).endOf('day');

    let spanDays = Math.ceil(moment.duration(moment(endDate).diff(moment(startDate))).asDays());
    let allSleepsByDay = new Array(spanDays);
    for (let i = 0; i < sleepActivities.length; i++) {
        let sleepDay = moment(sleepActivities[i].endTime).startOf('day');
        let sleepDayOffset = Math.ceil(moment.duration(sleepDay.diff(moment(startDate))).asDays());

        let sleepDayData = {
            duration: sleepActivities[i].durationAsHours(),
            day: sleepDay,
        };
        if (allSleepsByDay[sleepDayOffset]) {
            allSleepsByDay[sleepDayOffset].duration += sleepDayData.duration;
        } else {
            allSleepsByDay[sleepDayOffset] = sleepDayData;
        }
    }

    return allSleepsByDay.filter(d => d !== 'undefined');
}

////////////////////////////////////////////////////////////////////////////////
// Plotting functions
////////////////////////////////////////////////////////////////////////////////

function pixelColumnChart(dailyData, yAxisField) {
    const margin = 40;
    const columnWidth = 1;
    // const barMarginPercent = 0.1;
    // let columnWidth = (WIDTH - margin * 2) / weeklyData.length;
    // columnWidth -= columnWidth * barMarginPercent;

    let startDate = dailyData.map(d => d.day).reduce((x, r) => x < r ? x : r);
    let endDate = dailyData.map(d => d.day).reduce((x, r) => x > r ? x : r);
    // let maxHours = d3.max(dailyData.map(d => Math.abs(d.deviation)));
    let avgHours = dailyData.map(d => d[yAxisField]).reduce((x, r) => x + r) / dailyData.length;
    let hoursRange = d3.extent(dailyData.map(d => d[yAxisField]));

    let chart = d3.select('#plot')
        .attr('width', WIDTH)
        .attr('height', HEIGHT);

    let xScale = d3.scaleTime()
        .domain([startDate, endDate])
        .range([margin, WIDTH - margin * 2])

    let yScale = d3.scaleLinear()
        .domain(hoursRange)
        // .domain([-maxHours, maxHours])
        .range([0, HEIGHT - margin * 2]);

    let yScaleAxis = d3.scaleLinear()
        // .domain([-maxHours, maxHours])
        .domain(hoursRange)
        .range([HEIGHT - margin * 2, 0]);

    chart.append('g')
        .attr('transform', `translate(0, ${HEIGHT - margin * 2})`)
        .call(d3.axisBottom(xScale));
    chart.append('g')
        .call(d3.axisLeft(yScaleAxis))
        .attr('transform', `translate(${margin}, 0)`);

    chart.append('g')
        .selectAll('g')
        .data(dailyData)
        .enter().append('rect')
            .attr('width', 1)
            .attr('height', 1)
            .attr('fill', d => {
                let deviation = d[yAxisField] - avgHours;
                if (deviation > 0) return '#222';
                else return '#666';
            })
            .attr('height', (d, i) => {
                return Math.abs(yScale(d[yAxisField]) - yScale(avgHours));
            })
            .attr('x', (d, i) => xScale(d.day))
            .attr('y', (d, i) => {
                let deviation = d[yAxisField] - avgHours;
                let barHeight = Math.abs(yScale(d[yAxisField]) - yScale(avgHours));
                if (deviation >= 0)
                    return HEIGHT - margin * 2 - (yScale(avgHours) + barHeight);
                else
                    return HEIGHT - margin * 2 - yScale(avgHours);
            })
            .on('mouseover', (d, i, a) => {
                document.getElementById('data-preview').innerHTML = `Date: ${d.day.format('L')}, duration: ${d.duration}`;
                a[i].style.opacity = '50%';
            })
            .on('mouseout', (d, i, a) => {
                a[i].style.opacity = '100%';
            })
}

window.onload = start;