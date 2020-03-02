// What to visualize?
// - Bar chart of aggregated stats
// - Weekly calendar
// - Monthly calendar with daily bar charts / pie charts
// - Weekly bar charts?

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

function makeDurationBarChart(data) {
    d3.select('.chart')
        .selectAll('div')
            .data(data)
        .enter().append('div')
            .style('width', (d) => d * 0.8 + 'rem')
            .text((d) => d);
}

function init() {
    fetchData(DATA_FILE).then((dataStr) => {
        let data = d3.csvParse(dataStr, function(d) {
            return {
                start: new Date(d.From),
                end: new Date(d.To),
                duration: parseDuration(d.Duration),
                activity: d['Activity type'],
            }
        });

        let xdata = [4, 8, 15, 16, 23, 42];
        makeDurationBarChart(xdata);
    });
}

window.onload = init;