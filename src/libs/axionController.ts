import { KubernetesClient } from './kubernetes';
import { ArgoClient } from './argo';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import ShortUniqueId from 'short-unique-id';
import * as fs from 'fs/promises';

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

class AxionController {
    private k8sClient: KubernetesClient;
    private argoClient: ArgoClient;

    /**
     * 
     * @param k8sHost 
     * @param k8sSaToken 
     */
    constructor(k8sHost: string, k8sSaToken: string) {
        this.k8sClient = new KubernetesClient(k8sHost, k8sSaToken)
        this.argoClient = new ArgoClient(k8sHost, k8sSaToken)
    }

    /**
     * 
     * @param cloudCredentials 
     * @param cloudProvider 
     * @param ociAuthToken 
     * @param vaultTemporaryToken 
     */
    public async prepareTemporarySecret(cloudCredentials: string, cloudProvider: string, ociAuthUsername: string, ociAuthToken: string, vaultTemporaryToken?: string) {
        // Make sure we remove secret if it exists first
        try {
            await this.k8sClient.fetchSecret("temporary-axion-credentials", "axion-system")
            await this.k8sClient.deleteSecret("temporary-axion-credentials", "axion-system")
        } catch (_) { }

        // Create the temporary-axion-credentials secret
        await this.k8sClient.applyResource(`/api/v1/namespaces/axion-system/secrets`, {
            apiVersion: "v1",
            data: {
                "TARGET_CLOUD": Buffer.from(cloudProvider).toString('base64'),
                "GCP_REGION": Buffer.from("us-west1").toString('base64'),
                "GCP_JSON_KEY": Buffer.from(cloudCredentials).toString('base64'),
                "AXION_OCI_REGISTRY_USERNAME": Buffer.from(ociAuthUsername).toString('base64'),
                "AXION_OCI_REGISTRY_PASSWORD": Buffer.from(ociAuthToken).toString('base64'),
                "VAULT_SA_TEMP_TOKEN": vaultTemporaryToken ? Buffer.from(vaultTemporaryToken).toString('base64') : ""
            },
            kind: "Secret",
            metadata: {
                name: "temporary-axion-credentials"
            },
            type: "Opaque"
        });
    }

    /**
     * 
     * @param clusterEntity 
     * @param dnsEntity 
     * @param ctx 
     * @returns 
     */
    public computeArgumentsFile(clusterEntity: any, dnsEntity: any, ctx: any): any {
        // Prepare the Argo Workflow arguments for the Axion installation
        const manageSecretsWithVault = ctx.input.installExternalSecrets ? ctx.input.manageAxionSecretsWithVault : false;
        const args = {
            "axionSystemNamespace": "axion-system",
            "clusterRootDomain": dnsEntity.spec.isDnsSubdomain ? `${dnsEntity.spec.subdomain}.${dnsEntity.spec.domain}` : dnsEntity.spec.domain,
            "setupSecretName": "temporary-axion-credentials",
            "gcpProjectId": "captech-msi-gcp-dev", // TODO: Get this from the user input
            "axionOciRepo": `${clusterEntity.spec.data.ociRepo}/captech-msi/core/axion/mdundek/dev`,
            "axionOciRepoAuth": true,
            "manageSecretsWithVault": manageSecretsWithVault,
            "configureVaultAuth": manageSecretsWithVault,
            "pushVaultSecrets": manageSecretsWithVault,
            "proxyBaseCharts": true,
            "proxyBaseChartsRepo": `${clusterEntity.spec.data.ociRepo}/captech-msi/core/axion/mdundek/dev`,
            "proxyRegUseAuth": true,
            "argoCdManaged": ctx.input.installArgocd ? ctx.input.manageWithArgocd : false,
            "vaultServer": manageSecretsWithVault ? ctx.input.vaultEnvironment : "",
            "vaultNamespace": manageSecretsWithVault ? ctx.input.vaultNamespace : "",
            "vaultPolicyName": "axion-creds-secret-policy",
            "cloudCredsVaultSecretName": "cloud-acc-creds-secret",
            "ociCredsVaultSecretName": "oci-reg-creds-secret",
            "vaultAxionK8sSaName": "axion-k8s-vault",
            "vaultAxionClusterSecretStoreName": "axion-cluster-secret-store",
            "vaultAxionRoleName": "axion-volt-role",
            "vaultAxionKubernetesAuthPath": "kubernetes-axion-system",
            "k8sAuthHost": clusterEntity.spec.data.host,
            "installExternalSecrets": ctx.input.installExternalSecrets,
            "installArgoCd": ctx.input.installArgocd,
            "installCertManager": ctx.input.installCertManager,
            "installExternalDns": ctx.input.installExternalDns,
            "installIstio": ctx.input.installIstio,
            "createSelfSignedDefaultClusterIssuer": false,
            "createRootDomainAxionClusterIssuer": ctx.input.installCertManager,
            "certManagerEaDnsNameserver": "10.12.238.27:53",
            "certManagerValues": "installCRDs: true\nenableCertificateOwnerRef: true",
            "externalDnsValues": "provider: google\ngoogle:\n  project: captech-msi-gcp-dev\nsources:\n  - istio-gateway", // TODO: Get the project from the user input
            "istiodValues": "meshConfig:\n  enableAutoMtls: true\n  rootNamespace: istio-system\nconfigMapEnabled: true \nrevision: pilot",
            "istioGatewayValues": "revision: \"pilot\"\nservice:\n  annotations:\n    cloud.google.com/load-balancer-type: \"Internal\"",
            "createBackstageCatalogEntry": "true",
        };
        return args
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
     * 
     * @param ctx 
     * @param workflowFilePath 
     * @param workflowName 
     */
    public async deploy(ctx: any, workflowFilePath: string, workflowName: string) {
        // Run the workflow
        await this.argoClient.runWorkflow(
            ctx.logger,
            workflowFilePath,
            workflowName
        );
    }

    /**
     * 
     */
    public async createArgoWorkflowAdminSa() {
        try {
            await this.k8sClient.fetchRaw(`/api/v1/namespaces/argo/serviceaccounts/argo-admin`);
        } catch (error) {
            // Does not exist, create SA
            await this.k8sClient.applyResource(`/api/v1/namespaces/argo/serviceaccounts`, {
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
            await this.k8sClient.fetchRaw(`/apis/rbac.authorization.k8s.io/v1/clusterrolebindings/argo-admin-binding`);
        } catch (error) {

            await this.k8sClient.applyResource(`/apis/rbac.authorization.k8s.io/v1/clusterrolebindings`, {
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
            await this.k8sClient.fetchRaw(`/api/v1/namespaces/argo/secrets/argo-admin`);
        } catch (error) {
            // Does not exist, create SA
            await this.k8sClient.applyResource(`/api/v1/namespaces/argo/secrets`, {
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
     * 
     * @param repo 
     * @param username 
     * @param password 
     */
    public async createArgoPullSecret(repo: string, username: string, password: string) {
        let secretExists = false;
        try {
            await this.k8sClient.fetchRaw(`/api/v1/namespaces/argo/secrets/argo-sa-regcreds`);
            secretExists = true;
            // If still standing, we have a secret. Let's delete it first
            await this.k8sClient.deleteSecret("argo-sa-regcreds", "argo")
        } catch (error: any) {
            if (secretExists) {
                throw new Error(`Could not delete secret: ${error.message}`);
            }
        }

        await this.k8sClient.applyResource(`/api/v1/namespaces/argo/secrets`, {
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
     */
    public async createAxionSystemNamespace() {
        try {
            await this.k8sClient.fetchRaw(`/api/v1/namespaces/axion-system`);
        } catch (error) {
            // Does not exist, create SA
            await this.k8sClient.applyResource(`/api/v1/namespaces`, {
                "apiVersion": "v1",
                "kind": "Namespace",
                "metadata": {
                  "name": "axion-system"
                }
            })
        }
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
     * 
     * @param jsonKey 
     * @returns 
     */
    public async testCloudCreds(jsonKey: string, projectId: string) {
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
UNAUTHENTICATED=$(curl -H "Authorization: Bearer $ACCESS_TOKEN" https://cloudresourcemanager.googleapis.com/v1/projects/${projectId} | grep "UNAUTHENTICATED")
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
}

export { AxionController };