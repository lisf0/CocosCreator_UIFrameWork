import { Component, director, js, Node } from 'cc';
import fs from "fs";
import path from 'path';
import packageJSON from '../package.json';
import Const from "./Const";

const ProjectPath = Editor.Project.path;

// 临时在当前模块增加编辑器内的模块为搜索路径，为了能够正常 require 到 cc 模块，后续版本将优化调用方式
// module.paths.push(join(Editor.App.path, 'node_modules'));

// 当前版本需要在 module.paths 修改后才能正常使用 cc 模块
// 并且如果希望正常显示 cc 的定义，需要手动将 engine 文件夹里的 cc.d.ts 添加到插件的 tsconfig 里
// 当前版本的 cc 定义文件可以在当前项目的 temp/declarations/cc.d.ts 找到
// import { director } from 'cc';

/**
 * @en Registration method for the main process of Extension
 * @zh 为扩展的主进程的注册方法
 */
export const methods: { [key: string]: (...any: any) => any } = {
    /**
     * @en A method that can be triggered by message
     * @zh 通过 message 触发的方法
     */
    showLog() {
        console.log('Hello World');
    },


    bindRoot() {
        //@ts-ignore cce 没找到有声明,所以此处使用ts忽略
        let NodeRoot = cce.Scene.rootNode;
        this.bind(NodeRoot);
    },

    async bindNode() {
        var nodeIds = Editor.Selection.getSelected('node');

        if (nodeIds == null || nodeIds.length == 0 || nodeIds[0] == null || nodeIds[0] == "") {
            console.log('Please select a node.');
            return null;
        }

        if (nodeIds.length > 1) {
            console.log('Please select only one node.');
            return null;
        }

        const scene = director.getScene()
        if (scene) {
            for (let index = 0; index < nodeIds.length; index++) {
                const id = nodeIds[index];
                let node = this.findNodeByUUID(id, director.getScene());
                await this.bind(node);

            }
        }
    },

    async bind(NodeRoot: Node) {

        //@ts-ignore 
        const comp = NodeRoot.getComponent(ab.Component);

        if (!comp) {
            console.warn(`${NodeRoot.name} 没有挂载 继承自ABComponent 脚本`);
            return;
        }

        let configPath = path.join(ProjectPath, Const.ConfigUrl);
        let config = Const.DefaultConfig;
        if (fs.existsSync(configPath)) {
            console.log(`正在读取配置文件: ${ProjectPath}/${Const.ConfigUrl} 请稍等.`);
            let content = fs.readFileSync(`${ProjectPath}/${Const.ConfigUrl}`, { encoding: 'utf-8' });
            if (!content) {
                console.warn(`读取配置文件失败:${ProjectPath}/${Const.ConfigUrl}`);
                return;
            }
            config = JSON.parse(content);
        }


        // @ts-ignore
        const scriptUuid = comp.__scriptUuid;
        let ComponentScriptPath = await Editor.Message.request('asset-db', 'query-path', scriptUuid)

        console.log(ComponentScriptPath);

        if (ComponentScriptPath == null || ComponentScriptPath.length <= 0) {
            console.warn(`获取组件路径失败!`);
            return;
        }
        ComponentScriptPath = ComponentScriptPath.replace(/\\/g, "/");

        // let ProjectDir = Editor.Project.path;
        let UIComName = this.getABComponentName(NodeRoot);
        let AutoScriptName = `${UIComName}_Auto`;
        let AutoScriptPath = ``;

        const getAutoScriptPath = (config: any) => {

            let tempPath = "";

            let matchPath = `${ProjectPath}/${config.RootDir}`.replace(/\\/g, "/")
            if (config.ScriptsDir.startsWith("assets/")) {
                matchPath = `${ProjectPath}/${config.ScriptsDir}`.replace(/\\/g, "/")
            }

            if (ComponentScriptPath.startsWith(matchPath)) {
                if (config.ScriptsDir.startsWith("assets/")) {
                    tempPath = `${ProjectPath}/${config.ScriptsDir}/${Const.AutoScriptsDirName}/${AutoScriptName}.ts`.replace(/\\/g, "/");
                } else {
                    tempPath = `${ProjectPath}/${config.RootDir}/${config.ScriptsDir}/${Const.AutoScriptsDirName}/${AutoScriptName}.ts`.replace(/\\/g, "/");
                }
            }
            return tempPath;
        }

        if (Array.isArray(config)) {
            for (let index = 0; index < config.length; index++) {
                const element = config[index];
                AutoScriptPath = getAutoScriptPath(element);
                if (AutoScriptPath != "") {
                    break;
                }
            }
        } else {
            AutoScriptPath = getAutoScriptPath(config);
        }

        if (AutoScriptPath.length <= 0) {
            console.warn(`获取保存路径失败,请检查配置内容:${ProjectPath}/${Const.ConfigUrl}!`);
            return;
        }


        let nodeMaps: { [key: string]: string[] } = {}, importMaps: { [key: string]: string } = {};
        this.findNodes(NodeRoot, nodeMaps, importMaps, true);

        let _str_import = ``;
        for (let key in importMaps) {
            _str_import += `import ${key} from "${this.getImportPath(importMaps[key], AutoScriptPath)}"\n`;
        }
        let _cc_comps: string[] = [];
        let _str_content = ``;
        for (let key in nodeMaps) {
            let type = nodeMaps[key][0];
            let arr = type.split(".");
            if (arr[0] == "cc" && _cc_comps.indexOf(arr[1]) == -1) {
                _cc_comps.push(arr[1]);
                type = arr[1];
            }
            _str_content += `\t@property(${type})\n\t${key}: ${type} | null = null;\n`;
        }
        let _str_cc_comps = _cc_comps.length > 0 ? ', ' + _cc_comps.join(", ") : '';

        let strScript = `${_str_import}
import { _decorator, Component${_str_cc_comps} } from 'cc';
const { ccclass, property } = _decorator;

@ccclass("${AutoScriptName}")
export default class ${AutoScriptName} extends Component {
${_str_content} 
}`;

        let dbScriptPath = AutoScriptPath.replace(ProjectPath.replace(/\\/g, "/"), "db:/");
        this.saveFile(dbScriptPath, strScript)
        try {
            await Editor.Message.request('asset-db', 'refresh-asset', dbScriptPath);

            let autoComp = this.getComponent(NodeRoot, AutoScriptName);
            if (!autoComp) {
                const shortcuts = packageJSON.contributions.shortcuts.map(v => v.win).join(' / ');
                if (!js.getClassByName(AutoScriptName)) {
                    console.info(`请再执行一次 ${shortcuts}`);
                    return;
                }
                await Editor.Message.request('scene', 'create-component', { uuid: NodeRoot.uuid, component: AutoScriptName });
                // autoComp = this.getComponent(NodeRoot, AutoScriptName);  // ↑并不会实时附加上去
                console.info(`请再执行一次 ${shortcuts}`);
                return;
            }

            for (let key in nodeMaps) {

                let options = {
                    uuid: NodeRoot.uuid,
                    path: `__comps__.${this.getComponentIndex(NodeRoot, AutoScriptName)}.${key}`,
                    dump: {
                        type: nodeMaps[key][0],
                        value: {
                            uuid: nodeMaps[key][1],
                        }
                    }
                }

                if (options.dump.type != Const.SeparatorMap.Node) {
                    let appendComp = this.getComponent(this.findNodeByUUID(nodeMaps[key][1], NodeRoot), options.dump.type);
                    if (appendComp) {
                        options.dump.value = {
                            uuid: appendComp.uuid
                        };
                    }
                }

                Editor.Message.request('scene', 'set-property', options);
            }
            console.log(AutoScriptName + '.ts 生成成功');

        } catch (error) {
            console.log(error);
        }
    },

    saveFile(ScriptPath: string, strScript: string) {
        return new Promise(async (resolve, reject) => {

            const result = await Editor.Message.request(
                'asset-db',
                'create-asset',
                ScriptPath,
                strScript,
                { overwrite: true }
            );
            //   console.log('create‑or‑save 结果：', result);
            resolve(result);
        });
    },

    /** 计算相对路径 */
    getImportPath(exportPath: string, currPath: string): string {
        exportPath = exportPath.replace(/\\/g, "/").substr(0, exportPath.lastIndexOf("."));
        currPath = currPath.replace(/\\/g, "/");
        let tmp = "./";
        let start: number, end: number;
        let exportStr = exportPath.split("/");
        let currStr = currPath.split("/");
        for (end = 0; end < exportStr.length; ++end) {
            if (exportStr[end] != currStr[end]) {
                break;
            }
        }
        for (start = end + 1; start < currStr.length; ++start) {
            tmp += "../";
        }
        for (start = end; start < exportStr.length; ++start) {
            tmp += `${exportStr[start]}/`;
        }
        tmp = tmp.substr(0, tmp.length - 1);
        return tmp;
    },

    /** 获得Component的类名 */
    getComponentName(com: Component): string {
        let arr = com.name.match(/<.*>$/);
        if (arr && arr.length > 0) {
            return arr[0].slice(1, -1);
        }
        return com.name;
    },

    getABComponentName(node: Node) {

        //@ts-ignore 
        let coms = node.getComponents(ab.Component);

        // 优先取UI开头的组件
        for (let index = 0; index < coms.length; index++) {
            let name = this.getComponentName(coms[index]);
            if (name && name.startsWith("UI") && !name.endsWith("_Auto")) {
                return name;
            }
        }

        // 找不到UI开头的组件
        for (let index = 0; index < coms.length; index++) {
            let name = this.getComponentName(coms[index]);
            if (name && !name.endsWith("_Auto")) {
                return name;
            }
        }



        return null;
    },

    /**
     * 获取节点的组件
     * 解决因调用 Editor.Message.request('asset-db', 'refresh-asset' 后 将无法通过cc的getComponent来获得组件
     */
    getComponent(node: Node, name: any) {
        let com = null;
        if (typeof name == "string") {
            com = node.components.find(item => item.name == `${node.name}<${name}>`);
        }
        if (com == null) {
            com = node.getComponent(name);
        }
        return com;
    },
    /**
     * 获取组件下标
     * @param node 
     * @param name 
     * @returns 
     */
    getComponentIndex(node: Node, name: string) {
        let index = node.components.findIndex(item => item.name == `${node.name}<${name}>`);
        return index;
    },


    findNodeByUUID(uuid: string, rootNode: Node): any {
        if (rootNode.uuid == uuid) {
            return rootNode;
        }

        for (let i = 0; i < rootNode.children.length; i++) {
            let node = this.findNodeByUUID(uuid, rootNode.children[i]);
            if (node) {
                return node;
            }
        }
        return null;
    },

    async findNodes(node: Node, _nodeMaps: { [key: string]: string[] }, _importMaps: { [key: string]: string }, isRoot: boolean) {
        let name = node.name;
        if (!isRoot && this.checkNodePrefix(name)) {
            // 获得这个组件的类型 和 名称
            let names = this.getPrefixNames(name);
            if (names === null || names.length !== 2) {
                console.log(`${name} 命令不规范, 请使用_Label$xxx的格式!, 或者是在SysDefine中没有定义`);
                return;
            }
            let type = Const.SeparatorMap[names[0]] || names[0];
            let value = names[1];
            if (value.endsWith(Const.STANDARD_End)) {
                value = value.substring(0, value.length - Const.STANDARD_End.length);
            }

            // 进入到这里， 就表示可以绑定了
            if (_nodeMaps[value]) {
                console.log("出现了重名字段:", value);
            }
            _nodeMaps[value] = [type, node.uuid];

            // 检查是否是自定义组件
            let comp = node.getComponent(type);
            if (!_importMaps[type] && type.indexOf("cc.") === -1 && comp) {

                // @ts-ignore
                const scriptUuid = comp.__scriptUuid;
                const info = await Editor.Message.request('asset-db', 'query-asset-info', scriptUuid);
                if (info) {
                    // console.log('资源 URL:', info.url);
                    let componentPath = info.url;

                    componentPath = componentPath.replace(/\s*/g, "").replace(/\\/g, "/");
                    _importMaps[type] = componentPath;
                }
            }
        }

        if (isRoot || this.checkBindChildren(name)) {
            // 绑定子节点
            node.children.forEach(async (target: Node) => {
                await this.findNodes(target, _nodeMaps, _importMaps, false);
            });
        }
    },

    /** 检测前缀是否符合绑定规范 */
    checkNodePrefix(name: string) {
        if (name[0] !== Const.STANDARD_Prefix) {
            return false;
        }
        return true;
    },
    /** 检查后缀 */
    checkBindChildren(name: string) {
        if (name[name.length - 1] !== Const.STANDARD_End) {
            return true;
        }
        return false;
    },
    /** 获得类型和name */
    getPrefixNames(name: string) {
        if (name === null) {
            return '';
        }
        return name.substr(1, name.length).split(Const.STANDARD_Separator);
    }
};

/**
 * @en Method Triggered on Extension Startup
 * @zh 扩展启动时触发的方法
 */
export function load() { }

/**
 * @en Method triggered when uninstalling the extension
 * @zh 卸载扩展时触发的方法
 */
export function unload() { }
