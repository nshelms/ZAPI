var jwt = require('json-web-token');
var request = require('request');
var crypto = require('crypto');
var dotenv = require('dotenv');

export class ZAPI {

  private BASE_URL: string = 'https://prod-api.zephyr4jiracloud.com/connect';
  private API_PATH: string = '/public/rest/api/1.0';
  private BASE_API_URL: string = this.BASE_URL + this.API_PATH;

  constructor() {
    const result = dotenv.config();
    if (result.error) {
      throw result.error;
    }
  }

  public callZapiCloud(METHOD: string, API_URL: string, CONTENT_TYPE: string, ACCESS_KEY: string, SECRET_KEY: string, USER: string, BODY:string) {
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
      var result = this.createPromiseCall(false, options);
      return result;
  }

  private createPromiseCall(debug, params) {
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
  }

  public getCycleIdFromCycleName(jiraProjectId, jiraProjectVersion, cycleName) {
      return this.callZapiCloud.apply(void 0, ['GET', `${this.BASE_API_URL}/cycles/search?projectId=` + jiraProjectId + "&versionId=" + jiraProjectVersion, 'text/plain'].concat(__ZAPIcreds)).then(function (allCycles) {
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
  }

  public getAllCycles(jiraProjectId, jiraProjectVersion) {
      return this.callZapiCloud.apply(void 0, ['GET', `${this.BASE_API_URL}/cycles/search?expand=executionSummaries&projectId=` + jiraProjectId + "&versionId=" + jiraProjectVersion, 'text/plain'].concat(__ZAPIcreds)).then(function (d) { return JSON.parse(d).filter(function (a) { return a.name != 'Ad hoc'; }); })
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
  }

  public zqlSearch(query: string, fields?: object) {
      return this.callZapiCloud.apply(void 0, ['POST', `${this.BASE_API_URL}/zql/search?`, 'application/json'].concat(__ZAPIcreds, [{ 'zqlQuery': "" + query }])).then(function (searchResults) {
          var result = {
              totalTests: searchResults.totalCount,
              tests: []
          };
          searchResults.searchObjectList.forEach(function (a) {
              result.tests.push(a);
          });
          return result;
      });
  }
  public createNewCycle(body, cycleId) {
      if (cycleId) {
          return this.callZapiCloud.apply(void 0, ['POST', `${this.BASE_API_URL}/cycle?clonedCycleId=` + cycleId, 'application/json'].concat(__ZAPIcreds, [body]));
      }
      else {
          return this.callZapiCloud.apply(void 0, ['POST', `${this.BASE_API_URL}/cycle`, 'application/json'].concat(__ZAPIcreds, [body]));
      }
  }

  public createExecution(cycleId, projectId, versionId, issueId, testStatus, assignee) {
      var body = { 'status': { 'id': testStatus }, 'projectId': projectId, 'issueId': issueId, 'cycleId': cycleId, 'versionId': versionId, 'assigneeType': 'assignee', 'assignee': assignee };
      return this.callZapiCloud.apply(void 0, ['POST', `${this.BASE_API_URL}/execution`, 'application/json'].concat(__ZAPIcreds, [body])).then(function (createExecution) {
          return this.callZapiCloud.apply(void 0, ['PUT', `${this.BASE_API_URL}/execution/` + createExecution.execution.id, 'application/json'].concat(__ZAPIcreds, [{ 'status': { 'id': testStatus }, 'projectId': projectId, 'issueId': issueId, 'cycleId': cycleId, 'versionId': versionId }]));
      });
  }

  public getExecutionStatuses() {
      return this.callZapiCloud.apply(void 0, ['GET', `${this.BASE_API_URL}/execution/statuses`, 'application/json'].concat(__ZAPIcreds)).then(function (getStatuses) { return JSON.parse(getStatuses).forEach(function (a) { return console.log(a.id + " " + a.name + " " + a.description); }); });
  }

  public getExecutionInfo(issueId, projectId, cycleId, executionId) {
      return this.callZapiCloud.apply(void 0, ['GET', `${this.BASE_API_URL}/stepresult/search?executionId=` + executionId + "&issueId=" + issueId, 'application/text'].concat(__ZAPIcreds)).then(function (getStepResults) {
          var stepIds = [];
          JSON.parse(getStepResults).stepResults.forEach(function (a) {
              stepIds.push({ id: a.id, status: a.status.description });
          });
          stepIds.unshift('spacer');
          return { stepIds: stepIds, executionId: executionId };
      });
  }

  public stepResultUpdate(stepResultId, issueId, executionId, status) {
      var testStepData = { 'status': { 'id': status }, 'issueId': issueId, 'stepId': stepResultId, 'executionId': executionId };
      return this.callZapiCloud.apply(void 0, ['PUT', `${this.BASE_API_URL}/stepresult/` + stepResultId, 'application/json'].concat(__ZAPIcreds, [testStepData]));
  }

  public createNewTestStep(testStep, testData, expectedResult, testId, projectId) {
      var testStepData = { "step": testStep, "data": testData, "result": expectedResult };
      return this.callZapiCloud.apply(void 0, ['POST', `${this.BASE_API_URL}/teststep/` + testId + "?projectId=" + projectId, 'application/json'].concat(__ZAPIcreds, [testStepData]));
  }

  public testStepUpdate(testStep, testData, expectedResult, stepNum, testId, projectId) {
      var testStepData = {
          'orderId': stepNum,
          'issueId': testId,
          'step': testStep,
          'data': testData,
          'result': expectedResult,
          'createdBy': 'admin'
      };
      return this.callZapiCloud.apply(void 0, ['POST', `${this.BASE_API_URL}/teststep/` + testId + "?projectId=" + projectId, 'application/json'].concat(__ZAPIcreds, [testStepData]));
  }

  public deleteAllTestSteps(testId, projectId) {
      return this.callZapiCloud.apply(void 0, ['GET', `${this.BASE_API_URL}/teststep/` + testId + "?projectId=" + projectId, 'application/json'].concat(__ZAPIcreds)).then(function (testSteps) {
          var stepsArray = JSON.parse(testSteps);
          (function deleteStep() {
              if (stepsArray.length != 0) {
                  var step = stepsArray.shift();
                  return this.callZapiCloud.apply(void 0, ['DELETE', `${this.BASE_API_URL}/teststep/` + testId + "/" + step.id + "?projectId=" + projectId, 'application/text'].concat(__ZAPIcreds)).then(function (d) {
                      return deleteStep();
                  });
              }
              else {
                  return 'Deleted OK';
              }
          })();
      });
  }

  public getServerInfo() {
      return this.callZapiCloud.apply(void 0, ['GET', `${this.BASE_API_URL}/serverinfo`, 'application/text'].concat(__ZAPIcreds));
  }

  public getLicenseInfo() {
      return this.callZapiCloud.apply(void 0, ['GET', `${this.BASE_API_URL}/zlicense/addoninfo`, 'application/text'].concat(__ZAPIcreds));
  }

  public getGeneralInfo() {
      return this.callZapiCloud.apply(void 0, ['GET', `${this.BASE_API_URL}/config/generalinformation`, 'application/text'].concat(__ZAPIcreds));
  }

  public getCyclesIssueIds(cycleId, versionId, projectId) {
      return this.callZapiCloud.apply(void 0, ['GET', `${this.BASE_API_URL}/cycle/` + cycleId + "?expand=executionSummaries&projectId=" + projectId + "&versionId=" + versionId, 'text/plain'].concat(__ZAPIcreds));
  }

  public getTestSteps(issueId, projectId) {
      return this.callZapiCloud.apply(void 0, ['GET', `${this.BASE_API_URL}/teststep/` + issueId + "?projectId=" + projectId, 'application/json'].concat(__ZAPIcreds)).then(function (step) { return JSON.parse(step); });
  }

}
