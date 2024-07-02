"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArgoClient = void 0;
const kubernetes_1 = require("./kubernetes");
const gitlab_1 = require("./gitlab");
const yaml = __importStar(require("js-yaml"));
const child_process_1 = require("child_process");
const fs = __importStar(require("fs/promises"));
const KUBE_API_SERVER = process.env.KUBE_API_SERVER || 'https://kubernetes.default.svc';
const SA_TOKEN = process.env.KUBE_API_SA_TOKEN || '';
class ArgoClient {
    /**
     *
     * @param host
     * @param token
     */
    constructor(host, token) {
        this.KUBE_API_SERVER = host || KUBE_API_SERVER;
        this.SA_TOKEN = token || SA_TOKEN;
    }
    /**
     *
     * @param filePath
     * @param isAxionRepo
     * @param branchName
     */
    fetchWorkflowFromWorkflowRepo(filePath, isAxionRepo, branchName) {
        return __awaiter(this, void 0, void 0, function* () {
            const k8sClient = new kubernetes_1.KubernetesClient(this.KUBE_API_SERVER, this.SA_TOKEN);
            let secretValues = yield k8sClient.getSecretValues('backstage-system', 'backstage-secrets');
            const workflowsRepoProjectId = isAxionRepo ? secretValues["GITLAB_AXION_WORKFLOWS_REPO_ID"] : secretValues["GITLAB_BACKSTAGE_WORKFLOWS_REPO_ID"];
            const branchOrTag = branchName ? branchName : 'main';
            const personalAccessToken = secretValues.GITLAB_GROUP_BACKSTAGE_RW_TOKEN;
            let fileContent = yield gitlab_1.gitlab.downloadFile(workflowsRepoProjectId, filePath, branchOrTag, personalAccessToken);
            return yaml.load(fileContent);
        });
    }
    /**
     *
     * @param logger
     * @param workflowFilePath
     * @param workflowName
     */
    runWorkflow(logger, workflowFilePath, workflowName, proxied, debug) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const KUBE_API_SERVER = this.KUBE_API_SERVER;
                if (!KUBE_API_SERVER) {
                    reject(new Error("Service account token is undefined."));
                    return;
                }
                const SA_TOKEN = this.SA_TOKEN;
                if (!SA_TOKEN) {
                    reject(new Error("Service account token is undefined."));
                    return;
                }
                try {
                    const tmplYaml = fs.readFile(workflowFilePath, 'utf8');
                    console.log(tmplYaml);
                }
                catch (error) {
                    console.log("ERROR =>", error);
                }
                const childProcess = (0, child_process_1.spawn)(`argo`, [
                    "submit",
                    "--log",
                    workflowFilePath,
                    "--server",
                    KUBE_API_SERVER,
                    "--token",
                    SA_TOKEN,
                    "-n", "argo",
                    "--insecure-skip-tls-verify",
                    "--request-timeout", "30m"
                ]);
                const allLogs = [];
                let logTimeout;
                const resetLogTimeout = () => {
                    clearTimeout(logTimeout);
                    logTimeout = setTimeout(() => {
                        logger.info(" => Still processing...");
                        resetLogTimeout();
                    }, 20000);
                };
                resetLogTimeout(); // Initialize the timeout at the start
                const pattern1 = /Workflow\sStep:.+/;
                const pattern2 = /.+\s=>\s.+/;
                childProcess.stdout.on('data', (data) => {
                    const strippedData = data.toString().replace(/\x1b\[[0-9;]*m/g, '');
                    strippedData.split("\n").forEach((line) => {
                        if (proxied)
                            line = line.substring(line.indexOf(":") + 1);
                        allLogs.push(line);
                        if (debug) {
                            logger.info(line);
                        }
                        else {
                            if (pattern1.test(line)) {
                                logger.info("");
                                logger.info(` ${line.substring(line.indexOf(":") + 1, line.length).trim()}`);
                                resetLogTimeout();
                            }
                            else if (pattern2.test(line)) {
                                logger.info(` ${line.substring(line.indexOf(":") + 1, line.length).trim()}`);
                                resetLogTimeout();
                            }
                        }
                    });
                });
                childProcess.stderr.on('data', (data) => {
                    const strippedData = data.toString().replace(/\x1b\[[0-9;]*m/g, '');
                    strippedData.split("\n").forEach((line) => {
                        if (proxied)
                            line = line.substring(line.indexOf(":") + 1);
                        allLogs.push(line);
                        logger.error(line);
                        resetLogTimeout();
                    });
                });
                childProcess.on('close', () => {
                    clearTimeout(logTimeout);
                    this.fetchWorkflowStatus(workflowName).then((workflow) => {
                        const phase = workflow.status.phase;
                        switch (phase) {
                            case 'Failed':
                            case 'Error':
                                logger.error(allLogs.join("\n"));
                                reject(new Error("The workflow failed. Please check the logs for more information."));
                                return;
                            default:
                                resolve();
                        }
                    }).catch((err) => {
                        reject(err);
                    });
                });
            });
        });
    }
    /**
     *
     * @param workflowName
     */
    fetchWorkflowStatus(workflowName) {
        return __awaiter(this, void 0, void 0, function* () {
            const k8sClient = new kubernetes_1.KubernetesClient(this.KUBE_API_SERVER, this.SA_TOKEN);
            return yield k8sClient.fetchRaw(`/apis/argoproj.io/v1alpha1/namespaces/argo/workflows/${workflowName}`);
        });
    }
}
exports.ArgoClient = ArgoClient;
