var request = require('request');
module.exports = function(RED) {
    "use strict";
    function getEvent(n) {
        RED.nodes.createNode(this,n);
            
        this.google = RED.nodes.getNode(n.google);
        var api = 'https://www.googleapis.com/calendar/v3/calendars/'
        
        var timeMaxConvert = n.timeMax ? new Date(n.timeMax).toISOString() : ''
        var timeMinConvert = n.timeMin ? new Date(n.timeMin).toISOString() : ''
        var timeMax = 'timeMax=' + encodeURIComponent(timeMaxConvert)        
        var timeMin = '&timeMin=' + encodeURIComponent(timeMinConvert)

        this.calendar = n.calendar || 'primary';
        this.ongoing = n.ongoing || false;

        if (!this.google || !this.google.credentials.accessToken) {
            this.warn(RED._("calendar.warn.no-credentials"));
            return;
        }    
             
        var node = this;
        node.status({fill:"blue",shape:"dot",text:"calendar.status.querying"});
        calendarList(node, function(err) {
            if (err) {
                node.error(err,{});
                node.status({fill:"red",shape:"ring",text:"calendar.status.failed"});
                return;
            }
            node.status({});
            var linkUrl = api + node.calendars.primary.id + '/events?' + timeMax + timeMin
            var opts = {
                method: "GET",
                url: linkUrl,
                headers: {
                    "content-type": "application/json",
                    "Authorization": "Bearer " + node.google.credentials.accessToken
                }
            };                       

            node.on('input', function(msg) {
                request(opts, function (error, response, body) {                                             
                    var arrObj = [];
                    if (typeof(JSON.parse(body).items) == "undefined") {                 
                        msg.payload = "check your input!"
                        node.send(msg);
                        return;
                    }                       
                    JSON.parse(body).items.forEach(function (val) {
                        var obj = {};
                        var startDate;
                        var endDate;
                        if(typeof(val.start.dateTime) != "undefined") {
                            var dateObjStart = new Date(val.start.dateTime);
                            startDate = dateObjStart.getFullYear() + '/' + (dateObjStart.getMonth() + 1) + '/' + dateObjStart.getDate() + " " + dateObjStart.getHours() + ':' + dateObjStart.getMinutes();
                            var dateObjEnd = new Date(val.end.dateTime);                      
                            endDate = dateObjEnd.getFullYear() + '/' + (dateObjEnd.getMonth() + 1) + '/' + dateObjEnd.getDate() + " " + dateObjEnd.getHours() + ':' + dateObjEnd.getMinutes();
                        } else {
                            if(typeof(val.start.date) != "undefined") {
                                var dateObjStart = new Date(val.start.date);
                                startDate = dateObjStart.getFullYear() + '/' + (dateObjStart.getMonth() + 1) + '/' + dateObjStart.getDate();
                                var dateObjEnd = new Date(val.end.date);                      
                                endDate = dateObjEnd.getFullYear() + '/' + (dateObjEnd.getMonth() + 1) + '/' + dateObjEnd.getDate();
                            } else {
                                startDate = '';
                                endDate = '';
                            }
                        }

                        var title = '(No title)';
                        if(val.summary) title = val.summary;
                        var attend = [];
                        if(val.attendees) attend = val.attendees
                        
                        obj = {
                            "StartDate" : startDate,
                            "EndDate" : endDate,
                            "Title" : title,
                            "Attendees" : attend
                        }
                        arrObj.push(obj);
                    })
                                    
                    msg.payload = arrObj;
                    node.send(msg);                    
                }) 
            });            
        });
    }
    RED.nodes.registerType("GetEvent", getEvent);

    function calendarList(node, cb) {
        node.calendars = {};
        node.google.request('https://www.googleapis.com/calendar/v3/users/me/calendarList', function(err, data) {
            if (err) {
                cb(RED._("calendar.error.fetch-failed", {message:err.toString()}));
                return;
            }
            if (data.error) {
                cb(RED._("calendar.error.fetch-failed", {message:data.error.message}));
                return;
            }
            for (var i = 0; i < data.items.length; i++) {
                var cal = data.items[i];
                if (cal.primary) {
                    node.calendars.primary = cal;
                }
                node.calendars[cal.id] = cal;                
            }
            cb(null);
        });
    }
};
