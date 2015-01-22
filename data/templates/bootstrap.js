"use strict";

var http = require('http'),
    exec = require('child_process').exec,
    server = '<%=server%>',
    port = '<%=port%>',
    path = '/api/common/tasks/<%=identifier%>',
    RETRIES = 5;

/**
 * Synchronous each loop from caolan/async.
 * @private
 * @param arr
 * @param iterator
 * @param callback
 * @returns {*|Function}
 */
function eachSeries(arr, iterator, callback) {
    callback = callback || function () {};

    if (!arr.length) {
        return callback();
    }

    var completed = 0,
        iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                } else {
                    completed += 1;
                    if (completed >= arr.length) {
                        callback();
                    } else {
                        iterate();
                    }
                }
            });
        };

    iterate();
}

/**
 * Update Tasks - Takes the data from task execution and posts it back to the
 * API server.
 * @private
 * @param data
 * @param timeout
 * @param retries
 */
function updateTasks(data, timeout, retries) {
    var request = http.request({
        hostname: server,
        port: port,
        path: path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    }, function (res) {
        res.on('data', function () {
            // no-op to end the async call
        });

        res.on('end', function () {
            if (timeout && data.exit === undefined) {
                console.log("Sleeping " + timeout + " for Task Execution...");

                setTimeout(function () {
                    getTasks(timeout);
                }, timeout);
            } else {
                console.log("Task Execution Complete");

                process.exit(data.exit.code || 0);
            }
        });
    }).on('error', function (err) {
        console.log("Update Tasks Error: " + err);

        if (retries === undefined) {
            retries = 1;
        } else {
            retries = retries + 1;
        }

        if (retries < RETRIES) {
            console.log("Retrying Update Tasks Attempt #" + retries);

            setTimeout(function () {
                updateTasks(data, timeout, retries);
            }, timeout * retries);
        } else {
            console.log("Update Tasks retries completed, getting new tasks.");

            setTimeout(function () {
                getTasks(timeout);
            }, timeout);
        }
    });

    request.write(JSON.stringify(data));
    request.write("\n");
    request.end();
}

/**
 * Execute Tasks - Tasks the data from get tasks and executes each task serially
 * @private
 * @param data
 * @param timeout
 */
function executeTasks(data, timeout) {
    eachSeries(data.tasks, function (task, done) {
        console.log(task.cmd);

        exec(task.cmd, function (error, stdout, stderr) {
            task.stdout = stdout;
            task.stderr = stderr;
            task.error = error;

            console.log(task.stdout);
            console.log(task.stderr);

            if (task.error !== null) {
                console.log("Task Error (" + task.error.code + "): " +
                                task.stdout);
                console.log("ACCEPTED RESPONSES " + task.acceptedResponseCodes);
                if (task.acceptedResponseCodes &&
                    task.acceptedResponseCodes.indexOf(task.error.code) >= 0) {

                    console.log("Task " + task.cmd + " error code " + task.error.code +
                       " is acceptable, continuing...");
                    done();
                } else {
                    done(error);
                }
            } else {
                done();
            }
        });
    }, function () {
        updateTasks(data, timeout);
    });
}

/**
 * Get Tasks - Retrieves a task list from the API server.
 * @private
 * @param timeout
 */
function getTasks(timeout) {
    http.request({
        hostname: server,
        port: port,
        path: path,
        method: 'GET'
    }, function (res) {
        var data = "";

        res.on('data', function (chunk) {
            data += chunk;
        });

        res.on('end', function () {
            try {
                executeTasks(JSON.parse(data), timeout);
            } catch (error) {
                // 404 error doesn't run through the on error handler.
                console.log("No tasks available.");

                if (timeout) {
                    console.log("Sleeping " + timeout +
                                    " for Task Execution...");

                    setTimeout(function () {
                        getTasks(timeout);
                    }, timeout);
                } else {
                    console.log("Task Execution Complete");
                }
            }
        });
    }).on('error', function (err) {
        console.log("Get Tasks Error: " + err);

        if (timeout) {
            console.log("Sleeping " + timeout + " for Task Execution...");

            setTimeout(function () {
                getTasks(timeout);
            }, timeout);
        } else {
            console.log("Task Execution Complete");
        }
    }).end();
}

getTasks(5000);
