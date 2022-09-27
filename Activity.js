export class Activity {
    constructor(activityType, startTime, endTime) {
        this.activityType = activityType;
        this.startTime = moment(startTime);
        this.endTime = moment(endTime);
    }

    // Parse an Activity from ATimeLogger object, including:
    // Activity type
    // Duration
    // From
    // To
    // Comment
    static fromTimeLogger(timeLoggerObject) {
        // Verify it's a valid activity
        if (timeLoggerObject.To.length == 0) {
            return null;
        } else {
            return new Activity(timeLoggerObject['Activity type'], timeLoggerObject.From, timeLoggerObject.To);
        }
    }

    durationAsHours() {
        return moment.duration(this.endTime.diff(this.startTime)).asHours();
    }
}