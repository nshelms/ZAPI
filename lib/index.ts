var jwt = require('json-web-token');
var request = require('request');
var crypto = require('crypto');
var dotenv = require('dotenv');
declare var __ZAPIcreds: string[];

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

  public callZapiCloud(METHOD: string, API_URL: string, CONTENT_TYPE: string, ACCESS_KEY: string, SECRET_KEY: string, USER: string, BODY:string): Object {
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
      var token = jwt.encode(SECRET_KEY, payload, 'HS256', function (err: Error, token: string) {
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

  private createPromiseCall(debug: boolean, params: object) {
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

  public getCycleIdFromCycleName(jiraProjectId: string, jiraProjectVersion: string, cycleName: string): string {
      return this.callZapiCloud.apply(void 0, ['GET', `${this.BASE_API_URL}/cycles/search?projectId=` + jiraProjectId + "&versionId=" + jiraProjectVersion, 'text/plain'].concat(__ZAPIcreds)).then(function (allCycles: any) {
          var currentCycleId = findCycleByName(JSON.parse(allCycles), cycleName);
          if (currentCycleId) {
              return { projectId: jiraProjectId, versionId: jiraProjectVersion, id: currentCycleId };
          }
          else {
              return null;
          }
          function findCycleByName(allCycles, name: string) {
              var id = false;
              allCycles.forEach(function (item) {
                  item.name === name ? id = item.id : id = false;
              });
              return id;
          }
      });
  }

  public getAllCycles(jiraProjectId: string, jiraProjectVersion: string): Object[] {
      return this.callZapiCloud.apply(void 0, ['GET', `${this.BASE_API_URL}/cycles/search?expand=executionSummaries&projectId=` + jiraProjectId + "&versionId=" + jiraProjectVersion, 'text/plain'].concat(__ZAPIcreds)).then(function (d) { return JSON.parse(d).filter(function (a) { return a.name != 'Ad hoc'; }); })
          .then(function (allCycles: any) {
          var allCyclesResult: Object[] = [];
          allCycles.forEach(function (a) {
              var buildCycleObject: any = {};
              buildCycleObject.name = a.name;
              buildCycleObject.id = a.id;
              buildCycleObject.totalExecuted = a.totalExecuted;
              buildCycleObject.totalExecutions = a.totalExecutions;
              buildCycleObject.execSummaries = (function () {
                  var resultArray: Object[] = [];
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

  public zqlSearch(query: string, fields?: Object): Object {
      return this.callZapiCloud.apply(void 0, ['POST', `${this.BASE_API_URL}/zql/search?`, 'application/json'].concat(__ZAPIcreds, [JSON.stringify({ 'zqlQuery': "" + query })])).then(function (searchResults: any) {
          var result = {
              totalTests: searchResults.totalCount,
              tests: [] as any[]
          };
          searchResults.searchObjectList.forEach(function (a: any) {
              result.tests.push(a);
          });
          return result;
      });
  }
  public createNewCycle(body: string, cycleId: string): Object {
      if (cycleId) {
          return this.callZapiCloud.apply(void 0, ['POST', `${this.BASE_API_URL}/cycle?clonedCycleId=` + cycleId, 'application/json'].concat(__ZAPIcreds, [body]));
      }
      else {
          return this.callZapiCloud.apply(void 0, ['POST', `${this.BASE_API_URL}/cycle`, 'application/json'].concat(__ZAPIcreds, [body]));
      }
  }

  public createExecution(cycleId: string, projectId: string, versionId: string, issueId: string, testStatus: string, assignee: string): Object {
      var body = { 'status': { 'id': testStatus }, 'projectId': projectId, 'issueId': issueId, 'cycleId': cycleId, 'versionId': versionId, 'assigneeType': 'assignee', 'assignee': assignee };
      return this.callZapiCloud.apply(void 0, ['POST', `${this.BASE_API_URL}/execution`, 'application/json'].concat(__ZAPIcreds, [JSON.stringify(body)])).then(function (createExecution: any) {
          return this.callZapiCloud.apply(void 0, ['PUT', `${this.BASE_API_URL}/execution/` + createExecution.execution.id, 'application/json'].concat(__ZAPIcreds, [JSON.stringify({ 'status': { 'id': testStatus }, 'projectId': projectId, 'issueId': issueId, 'cycleId': cycleId, 'versionId': versionId })]));
      });
  }

  public getExecutionStatuses() {
      return this.callZapiCloud.apply(void 0, ['GET', `${this.BASE_API_URL}/execution/statuses`, 'application/json'].concat(__ZAPIcreds)).then(function (getStatuses: any) { return JSON.parse(getStatuses).forEach(function (a) { return console.log(a.id + " " + a.name + " " + a.description); }); });
  }

  public getExecutionInfo(issueId: string, projectId: string, cycleId: string, executionId: string) {
      return this.callZapiCloud.apply(void 0, ['GET', `${this.BASE_API_URL}/stepresult/search?executionId=` + executionId + "&issueId=" + issueId, 'application/text'].concat(__ZAPIcreds)).then(function (getStepResults) {
          var stepIds: Object[] = [];
          JSON.parse(getStepResults).stepResults.forEach(function (a) {
              stepIds.push({ id: a.id, status: a.status.description });
          });
          stepIds.unshift('spacer');
          return { stepIds: stepIds, executionId: executionId };
      });
  }

  public stepResultUpdate(stepResultId: string, issueId: string, executionId: string, status: string) {
      var testStepData = { 'status': { 'id': status }, 'issueId': issueId, 'stepId': stepResultId, 'executionId': executionId };
      return this.callZapiCloud.apply(void 0, ['PUT', `${this.BASE_API_URL}/stepresult/` + stepResultId, 'application/json'].concat(__ZAPIcreds, [JSON.stringify(testStepData)]));
  }

  public createNewTestStep(testStep: string, testData: string, expectedResult: string, testId: string, projectId: string) {
      var testStepData = { "step": testStep, "data": testData, "result": expectedResult };
      return this.callZapiCloud.apply(void 0, ['POST', `${this.BASE_API_URL}/teststep/` + testId + "?projectId=" + projectId, 'application/json'].concat(__ZAPIcreds, [JSON.stringify(testStepData)]));
  }

  public testStepUpdate(testStep: string, testData: string, expectedResult: string, stepNum: string, testId: string, projectId: string) {
      var testStepData = {
          'orderId': stepNum,
          'issueId': testId,
          'step': testStep,
          'data': testData,
          'result': expectedResult,
          'createdBy': 'admin'
      };
      return this.callZapiCloud.apply(void 0, ['POST', `${this.BASE_API_URL}/teststep/` + testId + "?projectId=" + projectId, 'application/json'].concat(__ZAPIcreds, [JSON.stringify(testStepData)]));
  }

  public deleteAllTestSteps(testId: string, projectId: string) {
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

  public getCyclesIssueIds(cycleId: string, versionId: string, projectId: string) {
      return this.callZapiCloud.apply(void 0, ['GET', `${this.BASE_API_URL}/cycle/` + cycleId + "?expand=executionSummaries&projectId=" + projectId + "&versionId=" + versionId, 'text/plain'].concat(__ZAPIcreds));
  }

  public getTestSteps(issueId: string, projectId: string) {
      return this.callZapiCloud.apply(void 0, ['GET', `${this.BASE_API_URL}/teststep/` + issueId + "?projectId=" + projectId, 'application/json'].concat(__ZAPIcreds)).then(function (step) { return JSON.parse(step); });
  }

}
