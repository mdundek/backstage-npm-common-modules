import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import ShortUniqueId from 'short-unique-id';
import * as fs from 'fs/promises';
import { gitlab } from './gitlab';

/**
 * fetchProxy
 * @param url 
 * @param options 
 * @returns 
 */
const fetchProxy = async (url: string, options: any) => {
    // Depending on the KubeAPI host used, the certificate might not be valid.
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    try {
        return await fetch(url, options);
    } finally {
        // Reenable right after the call
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
    }
} 

class ControllerBase {
    constructor() {}

    /**
     * createAwsProviderConfigSecret
     * @param k8sClient 
     * @param secretName 
     * @param namespace 
     * @param aws_access_key_id 
     * @param aws_secret_access_key 
     */
    public async createAwsProviderConfigSecret(k8sClient: any, secretName: string, namespace: string, aws_access_key_id: string, aws_secret_access_key: string) {
        // Make sure we remove secret if it exists first
        try {
            await k8sClient.fetchSecret(secretName, namespace)
            await k8sClient.deleteSecret(secretName, namespace)
        } catch (_) { }

        const base64KeyData = Buffer.from(`[default]
aws_access_key_id = ${aws_access_key_id}
aws_secret_access_key = ${aws_secret_access_key}`).toString('base64');

        // Create the temporary-axion-credentials secret
        await k8sClient.applyResource(`/api/v1/namespaces/${namespace}/secrets`, {
            apiVersion: "v1",
            data: {
                "credentials": base64KeyData
            },
            kind: "Secret",
            metadata: {
                name: secretName
            },
            type: "Opaque"
        });
    }

    /**
     * createGcpProviderConfigSecret
     * @param k8sClient 
     * @param secretName 
     * @param namespace 
     * @param jsonKey 
     */
    public async createGcpProviderConfigSecret(k8sClient: any, secretName: string, namespace: string, jsonKey: string) {
        // Make sure we remove secret if it exists first
        try {
            await k8sClient.fetchSecret(secretName, namespace)
            await k8sClient.deleteSecret(secretName, namespace)
        } catch (_) { }

        const base64KeyData = Buffer.from(jsonKey).toString('base64');

        // Create the temporary-axion-credentials secret
        await k8sClient.applyResource(`/api/v1/namespaces/${namespace}/secrets`, {
            apiVersion: "v1",
            data: {
                "credentials": base64KeyData
            },
            kind: "Secret",
            metadata: {
                name: secretName
            },
            type: "Opaque"
        });
    }

    /**
     * 
     * @param workflow 
     * @param replacements 
     * @returns 
     */
    public updateWorkflowSpecArguments(workflow: any, replacements: any): any {
        // Clone the workflow to avoid mutating the original object
        let updatedWorkflow = JSON.parse(JSON.stringify(workflow));

        // Iterate over the parameters in the workflow spec arguments
        if (updatedWorkflow.spec && updatedWorkflow.spec.arguments && updatedWorkflow.spec.arguments.parameters) {
            updatedWorkflow.spec.arguments.parameters = updatedWorkflow.spec.arguments.parameters.map((param: any) => {
                // Check if the param name exists in the replacements object
                if (replacements.hasOwnProperty(param.name)) {
                    // Update the value if there is a matching key in replacements
                    return {
                        ...param,
                        value: replacements[param.name]
                    };
                }
                return param;
            });
        }

        return updatedWorkflow;
    }

    /**
     * createArgoWorkflowAdminSa
     * @param k8sClient 
     */
    public async createArgoWorkflowAdminSa(k8sClient: any) {
        try {
            await k8sClient.fetchRaw(`/api/v1/namespaces/argo/serviceaccounts/argo-admin`);
        } catch (error) {
            // Does not exist, create SA
            await k8sClient.applyResource(`/api/v1/namespaces/argo/serviceaccounts`, {
                "apiVersion": "v1",
                "imagePullSecrets": [
                    {
                      "name": "argo-sa-regcreds"
                    }
                ],
                "kind": "ServiceAccount",
                "metadata": {
                    "name": "argo-admin",
                    "namespace": "argo"
                
                }
            })
        }

        try {
            await k8sClient.fetchRaw(`/apis/rbac.authorization.k8s.io/v1/clusterrolebindings/argo-admin-binding`);
        } catch (error) {
            await k8sClient.applyResource(`/apis/rbac.authorization.k8s.io/v1/clusterrolebindings`, {
                "apiVersion": "rbac.authorization.k8s.io/v1",
                "kind": "ClusterRoleBinding",
                "metadata": {
                    "name": "argo-admin-binding"
                },
                "roleRef": {
                    "apiGroup": "rbac.authorization.k8s.io",
                    "kind": "ClusterRole",
                    "name": "cluster-admin"
                },
                "subjects": [
                    {
                        "kind": "ServiceAccount",
                        "name": "argo-admin",
                        "namespace": "argo"
                    }
                ]
            })
            
        }

        try {
            await k8sClient.fetchRaw(`/api/v1/namespaces/argo/secrets/argo-admin`);
        } catch (error) {
            // Does not exist, create SA
            await k8sClient.applyResource(`/api/v1/namespaces/argo/secrets`, {
                "apiVersion": "v1",
                "kind": "Secret",
                "metadata": {
                    "name": "argo-admin",
                    "namespace": "argo",
                    "annotations": {
                        "kubernetes.io/service-account.name": "argo-admin"
                    }
                },
                "type": "kubernetes.io/service-account-token"
            })
        }
    }

    /**
     * createArgoPullSecret
     * @param k8sClient 
     * @param repo 
     * @param username 
     * @param password 
     */
    public async createArgoPullSecret(k8sClient: any, repo: string, username: string, password: string) {
        let secretExists = false;
        try {
            await k8sClient.fetchRaw(`/api/v1/namespaces/argo/secrets/argo-sa-regcreds`);
            secretExists = true;
            // If still standing, we have a secret. Let's delete it first
            await k8sClient.deleteSecret("argo-sa-regcreds", "argo")
        } catch (error: any) {
            if (secretExists) {
                throw new Error(`Could not delete secret: ${error.message}`);
            }
        }

        await k8sClient.applyResource(`/api/v1/namespaces/argo/secrets`, {
            "apiVersion": "v1",
            "data": {
                ".dockerconfigjson": btoa(`{"auths":{"${repo}":{"username":"${username}","password":"${password}","email":"DUMMY_DOCKER_EMAIL","auth":"${btoa(`${username}:${password}`)}"}}}`)
            },
            "kind": "Secret",
            "metadata": {
                "name": "argo-sa-regcreds",
                "namespace": "argo",
            },
            "type": "kubernetes.io/dockerconfigjson"
        })
    }

    /**
     * 
     * @param vaultToken 
     * @param vaultEnvironment 
     * @param vaultNamespace 
     * @returns 
     */
    public async testVaultCreds(vaultToken: string, vaultEnvironment: string, vaultNamespace: string) {
        if (process.env.NODE_ENV == "development") {
            return true;
        }
        let uid = new ShortUniqueId({ length: 5 });
        let secretName = `SECRET_SAMPLE_${uid.rnd().toUpperCase()}`;
        try {
            let response = await fetchProxy(
                `${vaultEnvironment}/v1/secrets/kv/data/${vaultNamespace}`,
                {
                    method: 'POST',
                    headers: {
                        'accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-Vault-Token': vaultToken,
                    },
                    body: `{ "data": { "${secretName}": "sample" } }`
                }
            );
            if (!response.ok) {
                throw new Error(`Could not access Vault, make sure your token is valid.`);
            }
            response = await fetchProxy(
                `https://${vaultEnvironment}.ess.ea.com/v1/secrets/kv/data/${vaultNamespace}/${secretName}`,
                {
                    method: 'DELETE',
                    headers: {
                        'accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-Vault-Token': vaultToken,
                    }
                }
            );
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 
     * @param repo 
     * @param username 
     * @param password 
     * @returns 
     */
    public async testOciCreds(repo: string, username: string, password: string) {
        let code = await this.runCommand("docker", ["--version"]);
        if (code != 0) {
            return true;
        }
       
        return (await this.runCommand("echo", [password, "|", "docker", "login", repo, "-u", username, "--password-stdin"]) == 0);
    }

    /**
     * testGcpCloudCreds
     * @param jsonKey 
     * @returns 
     */
    public async testGcpCloudCreds(jsonKey: string) {
        let code = await this.runCommand("gcloud", ["--version"]);
        if (code != 0) {
            return true;
        }

        // Create a temporary file
        const tempDir = os.tmpdir();
        const tempKeyFile = path.join(tempDir, `gcp-key-${Date.now()}.json`);
        const tempExecFile = path.join(tempDir, `gcp-key-${Date.now()}.sh`);
        try {
            // Write JSON key content to the temporary file
            await fs.writeFile(tempKeyFile, jsonKey);
            await fs.writeFile(tempExecFile, `#!/bin/bash
gcloud auth revoke | true
gcloud auth activate-service-account --key-file ${tempKeyFile}
ACCESS_TOKEN=$(gcloud auth print-access-token)
UNAUTHENTICATED=$(curl -H "Authorization: Bearer $ACCESS_TOKEN" https://cloudresourcemanager.googleapis.com/v1/projects/${JSON.parse(jsonKey).project_id} | grep "UNAUTHENTICATED")
if [ ! -z "$UNAUTHENTICATED" ]; then
    exit 1
fi`);
            await this.runCommand("chmod", ["a+x", tempExecFile]);
            if (await this.runCommand(tempExecFile) != 0) {
                return false;
            }
            return true
        } catch (error) {
            return false
        } finally {
            // Delete the temporary file
            try {
                await fs.unlink(tempKeyFile);
            } catch (_) {}
            try {
                await fs.unlink(tempExecFile);
            } catch (_) {}
        }
    }

    /**
     * 
     * @param token 
     * @param kubeApi 
     * @returns 
     */
    public async testKubeToken(token: string, kubeApi: string) {
        const response = await fetchProxy(`${kubeApi}/apis/authentication.k8s.io/v1/tokenreviews`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                "apiVersion": "authentication.k8s.io/v1",
                "kind": "TokenReview",
                "spec": {
                "token": token
                }
            })
        });
        if (!response.ok) {
            return false
        }
        return true;
    }

    /**
     * 
     * @param command 
     * @param args 
     * @returns 
     */
    private async runCommand(command: string, args: string[] = []) {
        return new Promise((resolve) => {
            const process = spawn(command, args);
            process.on('close', (exitCode: number) => {
                resolve(exitCode);
            });
        });
    }

    /**
     * ensureArgoIsInstalled
     * @param ctx 
     * @param k8sClient 
     */
    public async ensureArgoIsInstalled(ctx: any, k8sClient: any) {
        const argoNsExists = await k8sClient.namespaceExists("argo");
        if (!argoNsExists) {
            await k8sClient.createNamespace("argo");
        }
        const argoDeploymentExists = await k8sClient.hasDeployment("argo-server", "argo");
        if(!argoDeploymentExists) {
            ctx.logger.info(' => Installing Argo Workflow on target cluster...');
            
            await k8sClient.deployRemoteYaml(
                "https://github.com/argoproj/argo-workflows/releases/download/v3.5.7/quick-start-minimal.yaml",
                "argo"
            )
            ctx.logger.info(' => Successfully deployed Argo to the cluster.');
        } else {
            ctx.logger.info(' => Argo Workflow already installed.');
        }
    }

    /**
     * 
     * @param ctx 
     */
    public async deployBackstageWorkflowTemplates(ctx: any, k8sClient: any) {
        let secretValues = await k8sClient.getSecretValues('backstage-system', 'backstage-secrets');

        const workflowsRepoProjectId = secretValues.GITLAB_BACKSTAGE_WORKFLOWS_REPO_ID;
        const branchOrTag = 'main';
        const personalAccessToken = secretValues.GITLAB_GROUP_BACKSTAGE_RW_TOKEN;

        const templateFiles = await gitlab.getFilesFromFolder(
            workflowsRepoProjectId, 
            "templates", 
            branchOrTag, 
            personalAccessToken
        );
        for(let templatePath of templateFiles) {
            const templateYaml = await gitlab.fetchFile(workflowsRepoProjectId, templatePath, branchOrTag, personalAccessToken);
            const b64Buffer = Buffer.from(templateYaml.content, 'base64');
            // Parse the YAML content
            ctx.logger.info(` => Applying template ${templatePath}...`);
            // Apply to remote cluster
            await k8sClient.applyYaml(b64Buffer.toString('utf-8'))
        }
    }
}

export { ControllerBase };