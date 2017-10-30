"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var jwt = require("json-web-token");
var request = require("request");
var crypto = require("crypto");
var ZAPI = /** @class */ (function () {
    function ZAPI() {
        this.BASE_URL = 'https://prod-api.zephyr4jiracloud.com/connect';
        this.API_PATH = '/public/rest/api/1.0';
        this.BASE_API_URL = BASE_URL + API_PATH;
        var dotenv = requre('dotenv');
        var reslt = dotenv.config();
        if (result.error) {
            throw result.error;
        }
    }
    ZAPI.prototype.callZapiCloud = function (METHOD, API_URL, CONTENT_TYPE, ACCESS_KEY, SECRET_KEY, USER, BODY) {
        var hash = crypto.createHash('sha256');
        var iat = new Date().getTime();
        var exp = iat + 3600;
        var RELATIVE_PATH = API_URL.split(this.BASE_URL)[1].split('?')[0];
        var QUERY_STRING = API_URL.split(this.BASE_URL)[1].split('?')[1];
        var CANONICAL_PATH;
        if (QUERY_STRING) {
            CANONICAL_PATH = METHOD + "&" + RELATIVE_PATH + "&" + QUERY_STRING;
        }
        else {
            CANONICAL_PATH = METHOD + "&" + RELATIVE_PATH + "&";
        }
        hash.update(CANONICAL_PATH);
        var encodedQsh = hash.digest('hex');
        var payload = {
            'sub': USER,
            'qsh': encodedQsh,
            'iss': ACCESS_KEY,
            'iat': iat,
            'exp': exp
        };
        var token = jwt.encode(SECRET_KEY, payload, 'HS256', function (err, token) {
            if (err) {
                console.error(err.name, err.message);
            }
            else {
                return token;
            }
        });
        var options = {
            'method': METHOD, 'url': API_URL,
            'headers': {
                'zapiAccessKey': ACCESS_KEY,
                'Authorization': 'JWT ' + token,
                'Content-Type': CONTENT_TYPE
            },
            'json': BODY
        };
        var result = createPromiseCall(false, options);
        return result;
    };
    ZAPI.prototype.createPromiseCall = function (debug, params) {
        return new Promise(function (resolve, reject) {
            request(params, function (error, response, body) {
                if (error)
                    return reject(error);
                if (debug) {
                    console.log(params);
                    console.log(body);
                }
                resolve(body);
            });
        }).catch(function (e) { console.log("An error had occured with the api call: \"" + e + "\""); });
    };
    ZAPI.prototype.getCycleIdFromCycleName = function (jiraProjectId, jiraProjectVersion, cycleName) {
        return this.callZapiCloud.apply(void 0, ['GET', this.BASE_API_URL + "/cycles/search?projectId=" + jiraProjectId + "&versionId=" + jiraProjectVersion, 'text/plain'].concat(__ZAPIcreds)).then(function (allCycles) {
            var currentCycleId = findCycleByName(JSON.parse(allCycles), cycleName);
            if (currentCycleId) {
                return { projectId: jiraProjectId, versionId: jiraProjectVersion, id: currentCycleId };
            }
            else {
                return null;
            }
            function findCycleByName(allCycles, name) {
                var id = false;
                allCycles.forEach(function (item) {
                    item.name === name ? id = item.id : id = false;
                });
                return id;
            }
        });
    };
    ZAPI.prototype.getAllCycles = function (jiraProjectId, jiraProjectVersion) {
        return this.callZapiCloud.apply(void 0, ['GET', this.BASE_API_URL + "/cycles/search?expand=executionSummaries&projectId=" + jiraProjectId + "&versionId=" + jiraProjectVersion, 'text/plain'].concat(__ZAPIcreds)).then(function (d) { return JSON.parse(d).filter(function (a) { return a.name != 'Ad hoc'; }); })
            .then(function (allCycles) {
            var allCyclesResult = [];
            allCycles.forEach(function (a) {
                var buildCycleObject = {};
                buildCycleObject.name = a.name;
                buildCycleObject.id = a.id;
                buildCycleObject.totalExecuted = a.totalExecuted;
                buildCycleObject.totalExecutions = a.totalExecutions;
                buildCycleObject.execSummaries = (function () {
                    var resultArray = [];
                    a.executionSummaries.forEach(function (a) {
                        resultArray.push({
                            status: a.executionStatusName,
                            count: a.count
                        });
                    });
                    return resultArray;
                })();
                allCyclesResult.push(buildCycleObject);
            });
            return allCyclesResult;
        });
    };
    ZAPI.prototype.zqlSearch = function (query, fields) {
        return this.callZapiCloud.apply(void 0, ['POST', this.BASE_API_URL + "/zql/search?", 'application/json'].concat(__ZAPIcreds, [{ 'zqlQuery': "" + query }])).then(function (searchResults) {
            var result = {
                totalTests: searchResults.totalCount,
                tests: []
            };
            searchResults.searchObjectList.forEach(function (a) {
                result.tests.push(a);
            });
            return result;
        });
    };
    ZAPI.prototype.createNewCycle = function (body, cycleId) {
        if (cycleId) {
            return this.callZapiCloud.apply(void 0, ['POST', this.BASE_API_URL + "/cycle?clonedCycleId=" + cycleId, 'application/json'].concat(__ZAPIcreds, [body]));
        }
        else {
            return this.callZapiCloud.apply(void 0, ['POST', this.BASE_API_URL + "/cycle", 'application/json'].concat(__ZAPIcreds, [body]));
        }
    };
    ZAPI.prototype.createExecution = function (cycleId, projectId, versionId, issueId, testStatus, assignee) {
        var body = { 'status': { 'id': testStatus }, 'projectId': projectId, 'issueId': issueId, 'cycleId': cycleId, 'versionId': versionId, 'assigneeType': 'assignee', 'assignee': assignee };
        return this.callZapiCloud.apply(void 0, ['POST', this.BASE_API_URL + "/execution", 'application/json'].concat(__ZAPIcreds, [body])).then(function (createExecution) {
            return this.callZapiCloud.apply(void 0, ['PUT', this.BASE_API_URL + "/execution/" + createExecution.execution.id, 'application/json'].concat(__ZAPIcreds, [{ 'status': { 'id': testStatus }, 'projectId': projectId, 'issueId': issueId, 'cycleId': cycleId, 'versionId': versionId }]));
        });
    };
    ZAPI.prototype.getExecutionStatuses = function () {
        return this.callZapiCloud.apply(void 0, ['GET', this.BASE_API_URL + "/execution/statuses", 'application/json'].concat(__ZAPIcreds)).then(function (getStatuses) { return JSON.parse(getStatuses).forEach(function (a) { return console.log(a.id + " " + a.name + " " + a.description); }); });
    };
    ZAPI.prototype.getExecutionInfo = function (issueId, projectId, cycleId, executionId) {
        return this.callZapiCloud.apply(void 0, ['GET', this.BASE_API_URL + "/stepresult/search?executionId=" + executionId + "&issueId=" + issueId, 'application/text'].concat(__ZAPIcreds)).then(function (getStepResults) {
            var stepIds = [];
            JSON.parse(getStepResults).stepResults.forEach(function (a) {
                stepIds.push({ id: a.id, status: a.status.description });
            });
            stepIds.unshift('spacer');
            return { stepIds: stepIds, executionId: executionId };
        });
    };
    ZAPI.prototype.stepResultUpdate = function (stepResultId, issueId, executionId, status) {
        var testStepData = { 'status': { 'id': status }, 'issueId': issueId, 'stepId': stepResultId, 'executionId': executionId };
        return this.callZapiCloud.apply(void 0, ['PUT', this.BASE_API_URL + "/stepresult/" + stepResultId, 'application/json'].concat(__ZAPIcreds, [testStepData]));
    };
    ZAPI.prototype.createNewTestStep = function (testStep, testData, expectedResult, testId, projectId) {
        var testStepData = { "step": testStep, "data": testData, "result": expectedResult };
        return this.callZapiCloud.apply(void 0, ['POST', this.BASE_API_URL + "/teststep/" + testId + "?projectId=" + projectId, 'application/json'].concat(__ZAPIcreds, [testStepData]));
    };
    ZAPI.prototype.testStepUpdate = function (testStep, testData, expectedResult, stepNum, testId, projectId) {
        var testStepData = {
            'orderId': stepNum,
            'issueId': testId,
            'step': testStep,
            'data': testData,
            'result': expectedResult,
            'createdBy': 'admin'
        };
        return this.callZapiCloud.apply(void 0, ['POST', this.BASE_API_URL + "/teststep/" + testId + "?projectId=" + projectId, 'application/json'].concat(__ZAPIcreds, [testStepData]));
    };
    ZAPI.prototype.deleteAllTestSteps = function (testId, projectId) {
        return this.callZapiCloud.apply(void 0, ['GET', this.BASE_API_URL + "/teststep/" + testId + "?projectId=" + projectId, 'application/json'].concat(__ZAPIcreds)).then(function (testSteps) {
            var stepsArray = JSON.parse(testSteps);
            (function deleteStep() {
                if (stepsArray.length != 0) {
                    var step = stepsArray.shift();
                    return this.callZapiCloud.apply(void 0, ['DELETE', this.BASE_API_URL + "/teststep/" + testId + "/" + step.id + "?projectId=" + projectId, 'application/text'].concat(__ZAPIcreds)).then(function (d) {
                        return deleteStep();
                    });
                }
                else {
                    return 'Deleted OK';
                }
            })();
        });
    };
    ZAPI.prototype.getServerInfo = function () {
        return this.callZapiCloud.apply(void 0, ['GET', this.BASE_API_URL + "/serverinfo", 'application/text'].concat(__ZAPIcreds));
    };
    ZAPI.prototype.getLicenseInfo = function () {
        return this.callZapiCloud.apply(void 0, ['GET', this.BASE_API_URL + "/zlicense/addoninfo", 'application/text'].concat(__ZAPIcreds));
    };
    ZAPI.prototype.getGeneralInfo = function () {
        return this.callZapiCloud.apply(void 0, ['GET', this.BASE_API_URL + "/config/generalinformation", 'application/text'].concat(__ZAPIcreds));
    };
    ZAPI.prototype.getCyclesIssueIds = function (cycleId, versionId, projectId) {
        return this.callZapiCloud.apply(void 0, ['GET', this.BASE_API_URL + "/cycle/" + cycleId + "?expand=executionSummaries&projectId=" + projectId + "&versionId=" + versionId, 'text/plain'].concat(__ZAPIcreds));
    };
    ZAPI.prototype.getTestSteps = function (issueId, projectId) {
        return this.callZapiCloud.apply(void 0, ['GET', this.BASE_API_URL + "/teststep/" + issueId + "?projectId=" + projectId, 'application/json'].concat(__ZAPIcreds)).then(function (step) { return JSON.parse(step); });
    };
    return ZAPI;
}());
exports.ZAPI = ZAPI;
