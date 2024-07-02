import { KubernetesClient } from './kubernetes';
import { gitlab } from './gitlab';
import * as yaml from 'js-yaml';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';

const KUBE_API_SERVER = process.env.KUBE_API_SERVER || 'https://kubernetes.default.svc';
const SA_TOKEN = process.env.KUBE_API_SA_TOKEN || '';

class ArgoClient {
    private KUBE_API_SERVER?: string;
    private SA_TOKEN?: string;

    /**
     * 
     * @param host 
     * @param token 
     */
    constructor(host?: string, token?: string) {
        this.KUBE_API_SERVER = host || KUBE_API_SERVER;
        this.SA_TOKEN = token || SA_TOKEN;
    }

    /**
     * 
     * @param filePath 
     * @param isAxionRepo 
     * @param branchName 
     */
    public async fetchWorkflowFromWorkflowRepo(filePath: string, isAxionRepo?: boolean, branchName?: string): Promise<any> {
        const k8sClient = new KubernetesClient(this.KUBE_API_SERVER, this.SA_TOKEN)
        let secretValues = await k8sClient.getSecretValues('backstage-system', 'backstage-secrets');
	
        const workflowsRepoProjectId = isAxionRepo ? secretValues["GITLAB_AXION_WORKFLOWS_REPO_ID"] : secretValues["GITLAB_BACKSTAGE_WORKFLOWS_REPO_ID"];
        const branchOrTag = branchName ? branchName : 'main';
        const personalAccessToken = secretValues.GITLAB_GROUP_BACKSTAGE_RW_TOKEN;

        let fileContent = await gitlab.downloadFile(workflowsRepoProjectId, filePath, branchOrTag, personalAccessToken)

        return yaml.load(fileContent);
    }

    /**
     * 
     * @param logger 
     * @param workflowFilePath 
     * @param workflowName 
     */
    public async runWorkflow(logger: any, workflowFilePath: string, workflowName: string, proxied?: boolean, debug?: boolean): Promise<any> {
        return new Promise<void>((resolve, reject) => {
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
                const tmplYaml = fs.readFile(workflowFilePath, 'utf8')
                console.log(tmplYaml)
            } catch (error) {
                console.log("ERROR =>", error)
            }
            

            const childProcess = spawn(`argo`, [
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

            const allLogs: string[] = [];
            let logTimeout: NodeJS.Timeout;

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
            childProcess.stdout.on('data', (data:any) => {
                const strippedData = data.toString().replace(/\x1b\[[0-9;]*m/g, '');
                strippedData.split("\n").forEach((line: string) => {
                    if(proxied)
                        line = line.substring(line.indexOf(":")+1)
                    allLogs.push(line);
                    if(debug) {
                        logger.info(line)
                    } else {
                        if (pattern1.test(line)) {
                            logger.info("")
                            logger.info(` ${line.substring(line.indexOf(":")+1, line.length).trim()}`);
                            resetLogTimeout();
                        }
                        else if (pattern2.test(line)) {
                            logger.info(` ${line.substring(line.indexOf(":")+1, line.length).trim()}`);
                            resetLogTimeout();
                        }
                    }    
                });
            });
    
            childProcess.stderr.on('data', (data:any) => {
                const strippedData = data.toString().replace(/\x1b\[[0-9;]*m/g, '');
                strippedData.split("\n").forEach((line: string) => {
                    if(proxied)
                        line = line.substring(line.indexOf(":")+1)
                    allLogs.push(line);
                    logger.error(line);
                    resetLogTimeout();
                });
            });
    
            childProcess.on('close', () => {
                clearTimeout(logTimeout);
                this.fetchWorkflowStatus(workflowName).then((workflow:any) => {
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
                }).catch((err: any) => {
                    reject(err);
                });
            });
        });
    }

    /**
     * 
     * @param workflowName 
     */
    public async fetchWorkflowStatus(workflowName: string): Promise<any> {
        const k8sClient = new KubernetesClient(this.KUBE_API_SERVER, this.SA_TOKEN)
        return await k8sClient.fetchRaw(`/apis/argoproj.io/v1alpha1/namespaces/argo/workflows/${workflowName}`);
    }
}

export { ArgoClient };