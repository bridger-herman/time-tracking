import { groups, parseDuration } from "./index.js";

function getDurationComponents(decimalDuration) {
    let totalMinutes = decimalDuration * 60;
    let hours = (totalMinutes / 60).toFixed(0);
    if (hours < 10) hours = '0' + hours;
    let minutes = (totalMinutes % 60).toFixed(0);
    if (minutes < 10) minutes = '0' + minutes;
    return { hours, minutes };
}

async function readTextFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', (event) => {
            resolve(event.target.result);
        });
        reader.readAsText(file);
    });
}

function processCsv(csvText) {
    return d3.csvParse(csvText, (d) => {
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
}

function init() {
    const fileSelector = document.getElementById('file-selector');
    const statsDisplay = document.getElementById('stats-display');
    const groupsDisplay = document.getElementById('groups-display');

    let todayFull = new Date();
    let today = new Date(todayFull.getFullYear(), todayFull.getMonth(), todayFull.getDate());
    let thisMonday = new Date(today);
    // Get specific day of week: https://stackoverflow.com/a/3639224
    thisMonday.setDate(thisMonday.getDate() + (1 - 1 - thisMonday.getDay() - 7) % 7 + 1);

    let fileUpload = new Promise((resolve, reject) => {
        fileSelector.addEventListener('change', (event) => {
            resolve(event.target.files[0]);
        });
    });

    fileUpload
        .then((file) => readTextFile(file))
        .then((contents) => {
            let data = processCsv(contents);
            let thisWeek = data.filter((d) => {
                return +d.end < +todayFull && +d.end > +thisMonday;
            });
            let activityDurations = {};
            for (const entry of thisWeek) {
                if (activityDurations[entry.activity]) {
                    activityDurations[entry.activity] += entry.duration;
                } else {
                    activityDurations[entry.activity] = entry.duration;
                }
            }

            let groupDurations = {};
            for (const groupName in groups) {
                groupDurations[groupName] = 0.0;
            }
            for (const groupName in groups) {
                let groupActivities = groups[groupName];
                for (const activity in activityDurations) {
                    if (groupActivities.indexOf(activity) >= 0) {
                        groupDurations[groupName] += activityDurations[activity];
                    }
                }
            }

            for (const activity in activityDurations) {
                let p = document.createElement('p');
                let d = getDurationComponents(activityDurations[activity]);
                p.textContent = `${activity}: ${d.hours}:${d.minutes}`;
                statsDisplay.appendChild(p);
            }

            for (const grp in groupDurations) {
                let p = document.createElement('p');
                let d = getDurationComponents(groupDurations[grp]);
                p.textContent = `${grp}: ${d.hours}:${d.minutes}`;
                groupsDisplay.appendChild(p);
            }
        });

}

window.onload = init;