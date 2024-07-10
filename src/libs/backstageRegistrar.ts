import * as yaml from 'js-yaml';
import { KubernetesClient } from './kubernetes';

export interface GitlabInputsParameters {
    catalogDir: string;
    gitlabCredsSecretName: string;
    gitlabCredsSecretNamespace: string;
    gitlabCredsSecretProjectIdField: string;
}

export interface GlobalInputsParameters {
    recordType: string;
    resourceOwnerRef?: string;
    annotationNeotekType?: string;
    normalizedName: string;
    metadataTitle?: string;
    metadataDescription?: string;
    specOther?: string;
}

export interface ComponentInputsParameters {
    specType: string;
    specSystem?: string;
    subcomponentOf?: string;
    dependsOn1?: string;
    dependsOn2?: string;
    dependsOn3?: string;
    partOf1?: string;
    partOf2?: string;
    partOf3?: string;
}

/**
 * 
 */
export class BackstageComponentRegistrar {
    private componentInputs: ComponentInputsParameters;
    private globalInputs: GlobalInputsParameters;
    private gitlabInputs: GitlabInputsParameters;
    private gitlabToken: string;
    private gitlabProjectId: string;
    private genName: string;
    private branchName = "main";
    private commitMessage = "Automated backstage catalog update";
    private k8sClient: KubernetesClient;

    /**
     * 
     * @param kubectlInstance 
     * @param inputs 
     */
    constructor(gitlabInputs?: GitlabInputsParameters) {
        const gitlabInputParameters: GitlabInputsParameters = {
            catalogDir: "systems", // ok
            gitlabCredsSecretName: "backstage-secrets", // ok
            gitlabCredsSecretNamespace: "backstage-system", // ok
            gitlabCredsSecretProjectIdField: "GITLAB_BACKSTAGE_CATALOG_REPO_ID"
        };
        this.componentInputs = {} as ComponentInputsParameters;
        this.globalInputs = {} as GlobalInputsParameters;
        this.gitlabInputs = gitlabInputs ? gitlabInputs : gitlabInputParameters;
        this.gitlabToken = "";
        this.gitlabProjectId = "";
        this.genName = "";
        this.k8sClient = new KubernetesClient();
    }

    /**
     * 
     * @returns 
     */
    private async getGitlabToken(): Promise<string> {
        const response = await this.k8sClient.fetchSecret(
            this.gitlabInputs.gitlabCredsSecretName,
            this.gitlabInputs.gitlabCredsSecretNamespace
        );
        if (response.status === 200) {
            const secretData = await response.json();
            return Buffer.from(secretData.data.GITLAB_GROUP_BACKSTAGE_RW_TOKEN, 'base64').toString('utf-8');
        } else {
            throw new Error("Could not retrieve backstage secret")
        }
    }

    /**
     * 
     * @returns 
     */
    private async getGitlabProjectId(): Promise<string> {
        const response = await this.k8sClient.fetchSecret(
            this.gitlabInputs.gitlabCredsSecretName,
            this.gitlabInputs.gitlabCredsSecretNamespace
        );
        if (response.status === 200) {
            const secretData = await response.json();
            return Buffer.from(secretData.data[this.gitlabInputs.gitlabCredsSecretProjectIdField], 'base64').toString('utf-8');
        } else {
            throw new Error("Could not retrieve backstage secret")
        }
    }

    /**
     * 
     * @returns 
     */
    private generateComponentYaml(): string {
        const {
            metadataTitle,
            metadataDescription,
            resourceOwnerRef, 
            specOther,
            annotationNeotekType
        } = this.globalInputs;

        const {
            specType, specSystem,
            subcomponentOf,
            dependsOn1, dependsOn2, dependsOn3, partOf1, partOf2, partOf3
        } = this.componentInputs;

        let yaml = `apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: ${this.genName}
  namespace: default
  title: ${metadataTitle}
  description: "${metadataDescription ? metadataDescription : ''}"
  annotations:
    neotek.ea.com/component-type: ${annotationNeotekType}
spec:
  type: ${specType}
  owner: ${resourceOwnerRef}
  lifecycle: production`;

        if (specSystem) yaml += `\n  system: ${specSystem}`;
        if (specOther) yaml += `\n${specOther.split('\n').map(line => `  ${line}`).join('\n')}`;
        if (subcomponentOf) yaml += `\n  subcomponentOf: ${subcomponentOf}`;
        if (dependsOn1 || dependsOn2 || dependsOn3) {
            yaml += `\n  dependsOn:`;
            if (dependsOn1) yaml += `\n    - ${dependsOn1}`;
            if (dependsOn2) yaml += `\n    - ${dependsOn2}`;
            if (dependsOn3) yaml += `\n    - ${dependsOn3}`;
        }
        if (partOf1 || partOf2 || partOf3) {
            yaml += `\n  partOf:`;
            if (partOf1) yaml += `\n    - ${partOf1}`;
            if (partOf2) yaml += `\n    - ${partOf2}`;
            if (partOf3) yaml += `\n    - ${partOf3}`;
        }

        return yaml;
    }

    /**
     * 
     * @returns 
     */
    private generateSystemYaml(): string {
        const {
            metadataTitle,
            metadataDescription,
            resourceOwnerRef, 
            specOther,
            annotationNeotekType
        } = this.globalInputs;

        let yaml = `apiVersion: backstage.io/v1alpha1
kind: System
metadata:
  name: ${this.genName}
  namespace: default
  title: ${metadataTitle}
  description: "${metadataDescription ? metadataDescription : ''}"
  annotations:
    neotek.ea.com/component-type: ${annotationNeotekType}
spec:
  owner: ${resourceOwnerRef}`;
        if (specOther) yaml += `\n${specOther.split('\n').map(line => `  ${line}`).join('\n')}`;
        return yaml;
    }

    /**
     * 
     * @param filePath 
     * @param branchName 
     * @returns 
     */
    private async fileExists(filePath: string, branchName: string): Promise<boolean> {
        const response = await fetch(`https://gitlab.ea.com/api/v4/projects/${this.gitlabProjectId}/repository/files/${encodeURIComponent(filePath)}?ref=${branchName}`, {
            headers: {
                'PRIVATE-TOKEN': this.gitlabToken
            }
        });
        return response.ok;
    }

    /**
     * 
     * @param filePath 
     * @param content 
     */
    private async updateOrCreateFile(filePath: string, content: string) {
        const url = `https://gitlab.ea.com/api/v4/projects/${this.gitlabProjectId}/repository/files/${encodeURIComponent(filePath)}`;
        const payload = {
            branch: this.branchName,
            content,
            commit_message: this.commitMessage
        };

        const method = await this.fileExists(filePath, this.branchName) ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'PRIVATE-TOKEN': this.gitlabToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Failed to ${method === 'PUT' ? 'update' : 'create'} the file`);
        }
    }

     /**
     * 
     * @param filePath 
     */
     private async deleteFile(filePath: string) {
        if(!await this.fileExists(filePath, this.branchName)) {
            return;
        }

        const url = `https://gitlab.ea.com/api/v4/projects/${this.gitlabProjectId}/repository/files/${encodeURIComponent(filePath)}`;
        const payload = {
            branch: this.branchName,
            commit_message: this.commitMessage
        };

        const response = await fetch(url, {
            method: "DELETE",
            headers: {
                'PRIVATE-TOKEN': this.gitlabToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Failed todelete the file`);
        }
    }

    /**
     * 
     * @param filePath 
     * @returns 
     */
    private async getFileContent(filePath: string): Promise<string> {
        const response = await fetch(`https://gitlab.ea.com/api/v4/projects/${this.gitlabProjectId}/repository/files/${encodeURIComponent(filePath)}/raw?ref=${this.branchName}`, {
            headers: {
                'PRIVATE-TOKEN': this.gitlabToken
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch the file content');
        }

        return response.text();
    }

    /**
     * 
     * @param locationsContent 
     * @param newLocation 
     * @returns 
     */
    private updateLocationsFileContent(locationsContent: string, newLocation: string): string {
        const locationsYaml: any = yaml.load(locationsContent);
        if (!locationsYaml.spec.targets.includes(newLocation)) {
            locationsYaml.spec.targets.push(newLocation);
        }
        return yaml.dump(locationsYaml);
    }

    /**
     * 
     * @param locationsContent 
     * @param toDelLocation 
     * @returns 
     */
    private removeLocationsFileContent(locationsContent: string, toDelLocation: string): string {
        const locationsYaml: any = yaml.load(locationsContent);
        locationsYaml.spec.targets = locationsYaml.spec.targets.filter((location: string) => location !== toDelLocation);
        return yaml.dump(locationsYaml);
    }

    /**
     * 
     * @param newLocation 
     */
    private async updateLocationsFile(newLocation: string) {
        const locationsFilePath = 'locations.yaml';

        let locationsContent = await this.getFileContent(locationsFilePath);
        locationsContent = this.updateLocationsFileContent(locationsContent, newLocation);

        await this.updateOrCreateFile(locationsFilePath, locationsContent);
    }

    /**
     * 
     * @param toDelLocation 
     */
    private async removeLocationFile(toDelLocation: string) {
        const locationsFilePath = 'locations.yaml';

        let locationsContent = await this.getFileContent(locationsFilePath);
        locationsContent = this.removeLocationsFileContent(locationsContent, toDelLocation);

        await this.updateOrCreateFile(locationsFilePath, locationsContent);
    }

    /**
     * 
     * @param globalInputs 
     * @param componentInputs 
     * @returns 
     */
    public async registerComponentInCatalog(globalInputs: GlobalInputsParameters, componentInputs: ComponentInputsParameters) {
        this.componentInputs = componentInputs;
        this.globalInputs = globalInputs;
        this.genName = `${this.globalInputs.recordType}-${this.globalInputs.normalizedName}`;
        this.gitlabToken = "";
        this.gitlabProjectId = ""

        this.gitlabToken = await this.getGitlabToken();
        this.gitlabProjectId = await this.getGitlabProjectId(); 

        const catalogFilePath = `${this.gitlabInputs.catalogDir}/${this.globalInputs.normalizedName}.yaml`;
        const yamlContent = this.generateComponentYaml();

        await this.updateOrCreateFile(catalogFilePath, yamlContent);
        await this.updateLocationsFile(`./${catalogFilePath}`);

        return this.genName;
    }

    /**
     * 
     * @param systemRef 
     * @param recordType 
     * @param name 
     * @returns 
     */
    public static computeCatalogInfoPath(systemRef: string, recordType: string, name: string): string {
        return `${this.normalizeSystemRef(systemRef)}/${recordType}/${this.normalizeSystemRef(name)}.yaml`;
    }

    /**
     * normalizeSystemRef
     * @param input 
     * @param minimal 
     * @returns 
     */
    public static normalizeSystemRef(input: string, minimal: boolean = true): string {
        let withoutPrefix = input.replace(/^component:/, '');
        withoutPrefix = withoutPrefix.replace(/^system:/, '');
        if(minimal) {
            withoutPrefix = withoutPrefix.replace(/^default\//, '').toLowerCase();
        } else {
            withoutPrefix = withoutPrefix.replace(/\//g, '-');
            withoutPrefix = withoutPrefix.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
        }
        withoutPrefix = withoutPrefix.replace(/\//g, '-');
        return withoutPrefix;
    }

    /**
     * 
     * @param globalInputs 
     * @param componentInputs 
     * @returns 
     */
    public async unregisterEntityFromCatalog(globalInputs: GlobalInputsParameters) {
        this.globalInputs = globalInputs;
        this.genName = `${this.globalInputs.recordType}-${this.globalInputs.normalizedName}`;
        this.gitlabToken = "";
        this.gitlabProjectId = ""

        this.gitlabToken = await this.getGitlabToken();
        this.gitlabProjectId = await this.getGitlabProjectId(); 

        const catalogFilePath = `${this.gitlabInputs.catalogDir}/${this.globalInputs.normalizedName}.yaml`;

        await this.deleteFile(catalogFilePath);
        await this.removeLocationFile(`./${catalogFilePath}`);
    }

     /**
     * 
     */
     public async registerSystemInCatalog(globalInputs: GlobalInputsParameters) {
        this.globalInputs = globalInputs;
        this.genName = `${this.globalInputs.recordType}-${this.globalInputs.normalizedName}`;
        this.gitlabToken = "";
        this.gitlabProjectId = ""

        this.gitlabToken = await this.getGitlabToken();
        this.gitlabProjectId = await this.getGitlabProjectId(); 

        const catalogFilePath = `${this.gitlabInputs.catalogDir}/${this.globalInputs.normalizedName}.yaml`;
        const yamlContent = this.generateSystemYaml();

        await this.updateOrCreateFile(catalogFilePath, yamlContent);
        await this.updateLocationsFile(`./${catalogFilePath}`);

        return this.genName;
    }
}
