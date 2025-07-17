"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
exports.load = load;
exports.unload = unload;
const cc_1 = require("cc");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const package_json_1 = __importDefault(require("../package.json"));
const Const_1 = __importDefault(require("./Const"));
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
exports.methods = {
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
        const scene = cc_1.director.getScene();
        if (scene) {
            for (let index = 0; index < nodeIds.length; index++) {
                const id = nodeIds[index];
                let node = this.findNodeByUUID(id, cc_1.director.getScene());
                await this.bind(node);
            }
        }
    },
    async bind(NodeRoot) {
        //@ts-ignore 
        const comp = NodeRoot.getComponent(ab.Component);
        if (!comp) {
            console.warn(`${NodeRoot.name} 没有挂载 继承自ABComponent 脚本`);
            return;
        }
        let configPath = path_1.default.join(ProjectPath, Const_1.default.ConfigUrl);
        let config = Const_1.default.DefaultConfig;
        if (fs_1.default.existsSync(configPath)) {
            console.log(`正在读取配置文件: ${ProjectPath}/${Const_1.default.ConfigUrl} 请稍等.`);
            let content = fs_1.default.readFileSync(`${ProjectPath}/${Const_1.default.ConfigUrl}`, { encoding: 'utf-8' });
            if (!content) {
                console.warn(`读取配置文件失败:${ProjectPath}/${Const_1.default.ConfigUrl}`);
                return;
            }
            config = JSON.parse(content);
        }
        // @ts-ignore
        const scriptUuid = comp.__scriptUuid;
        let ComponentScriptPath = await Editor.Message.request('asset-db', 'query-path', scriptUuid);
        console.log(ComponentScriptPath);
        if (ComponentScriptPath == null || ComponentScriptPath.length <= 0) {
            console.warn(`获取组件路径失败!`);
            return;
        }
        ComponentScriptPath = ComponentScriptPath.replace(/\\/g, "/");
        // let ProjectDir = Editor.Project.path;
        let UIComName = this.getABComponentName(NodeRoot);
        if (UIComName == null) {
            console.warn(`未找到ABComponent的组件!`);
            return;
        }
        let AutoScriptName = `${UIComName}_Auto`;
        let AutoScriptPath = ``;
        const getAutoScriptPath = (config) => {
            let tempPath = "";
            let matchPath = `${ProjectPath}/${config.RootDir}`.replace(/\\/g, "/");
            if (config.ScriptsDir.startsWith("assets/")) {
                matchPath = `${ProjectPath}/${config.ScriptsDir}`.replace(/\\/g, "/");
            }
            if (ComponentScriptPath.startsWith(matchPath)) {
                if (config.ScriptsDir.startsWith("assets/")) {
                    tempPath = `${ProjectPath}/${config.ScriptsDir}/${Const_1.default.AutoScriptsDirName}/${AutoScriptName}.ts`.replace(/\\/g, "/");
                }
                else {
                    tempPath = `${ProjectPath}/${config.RootDir}/${config.ScriptsDir}/${Const_1.default.AutoScriptsDirName}/${AutoScriptName}.ts`.replace(/\\/g, "/");
                }
            }
            return tempPath;
        };
        if (Array.isArray(config)) {
            for (let index = 0; index < config.length; index++) {
                const element = config[index];
                AutoScriptPath = getAutoScriptPath(element);
                if (AutoScriptPath != "") {
                    break;
                }
            }
        }
        else {
            AutoScriptPath = getAutoScriptPath(config);
        }
        if (AutoScriptPath.length <= 0) {
            console.warn(`获取保存路径失败,请检查配置内容:${ProjectPath}/${Const_1.default.ConfigUrl}!`);
            return;
        }
        let nodeMaps = {}, importMaps = {};
        this.findNodes(NodeRoot, nodeMaps, importMaps, true);
        let _str_import = ``;
        for (let key in importMaps) {
            _str_import += `import ${key} from "${this.getImportPath(importMaps[key], AutoScriptPath)}"\n`;
        }
        let _cc_comps = [];
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
        this.saveFile(dbScriptPath, strScript);
        try {
            await Editor.Message.request('asset-db', 'refresh-asset', dbScriptPath);
            let autoComp = this.getComponent(NodeRoot, AutoScriptName);
            if (!autoComp) {
                const shortcuts = package_json_1.default.contributions.shortcuts.map(v => v.win).join(' / ');
                if (!cc_1.js.getClassByName(AutoScriptName)) {
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
                };
                if (options.dump.type != Const_1.default.SeparatorMap.Node) {
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
        }
        catch (error) {
            console.log(error);
        }
    },
    saveFile(ScriptPath, strScript) {
        return new Promise(async (resolve, reject) => {
            const result = await Editor.Message.request('asset-db', 'create-asset', ScriptPath, strScript, { overwrite: true });
            //   console.log('create‑or‑save 结果：', result);
            resolve(result);
        });
    },
    /** 计算相对路径 */
    getImportPath(exportPath, currPath) {
        exportPath = exportPath.replace(/\\/g, "/").substr(0, exportPath.lastIndexOf("."));
        currPath = currPath.replace(/\\/g, "/");
        let tmp = "./";
        let start, end;
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
    getComponentName(com) {
        let arr = com.name.match(/<.*>$/);
        if (arr && arr.length > 0) {
            return arr[0].slice(1, -1);
        }
        return com.name;
    },
    getABComponentName(node) {
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
    getComponent(node, name) {
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
    getComponentIndex(node, name) {
        let index = node.components.findIndex(item => item.name == `${node.name}<${name}>`);
        return index;
    },
    findNodeByUUID(uuid, rootNode) {
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
    async findNodes(node, _nodeMaps, _importMaps, isRoot) {
        let name = node.name;
        if (!isRoot && this.checkNodePrefix(name)) {
            // 获得这个组件的类型 和 名称
            let names = this.getPrefixNames(name);
            if (names === null || names.length !== 2) {
                console.log(`${name} 命令不规范, 请使用_Label$xxx的格式!, 或者是在SysDefine中没有定义`);
                return;
            }
            let type = Const_1.default.SeparatorMap[names[0]] || names[0];
            let value = names[1];
            if (value.endsWith(Const_1.default.STANDARD_End)) {
                value = value.substring(0, value.length - Const_1.default.STANDARD_End.length);
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
            node.children.forEach(async (target) => {
                await this.findNodes(target, _nodeMaps, _importMaps, false);
            });
        }
    },
    /** 检测前缀是否符合绑定规范 */
    checkNodePrefix(name) {
        if (name[0] !== Const_1.default.STANDARD_Prefix) {
            return false;
        }
        return true;
    },
    /** 检查后缀 */
    checkBindChildren(name) {
        if (name[name.length - 1] !== Const_1.default.STANDARD_End) {
            return true;
        }
        return false;
    },
    /** 获得类型和name */
    getPrefixNames(name) {
        if (name === null) {
            return '';
        }
        return name.substr(1, name.length).split(Const_1.default.STANDARD_Separator);
    }
};
/**
 * @en Method Triggered on Extension Startup
 * @zh 扩展启动时触发的方法
 */
function load() { }
/**
 * @en Method triggered when uninstalling the extension
 * @zh 卸载扩展时触发的方法
 */
function unload() { }
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zb3VyY2Uvc2NlbmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBdVpBLG9CQUEwQjtBQU0xQix3QkFBNEI7QUE3WjVCLDJCQUFtRDtBQUNuRCw0Q0FBb0I7QUFDcEIsZ0RBQXdCO0FBQ3hCLG1FQUEwQztBQUMxQyxvREFBNEI7QUFFNUIsTUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7QUFFeEMsMkRBQTJEO0FBQzNELDREQUE0RDtBQUU1RCx1Q0FBdUM7QUFDdkMsaUVBQWlFO0FBQ2pFLHFEQUFxRDtBQUNyRCxpQ0FBaUM7QUFFakM7OztHQUdHO0FBQ1UsUUFBQSxPQUFPLEdBQTRDO0lBQzVEOzs7T0FHRztJQUNILE9BQU87UUFDSCxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFHRCxRQUFRO1FBQ0osa0NBQWtDO1FBQ2xDLElBQUksUUFBUSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDO1FBQ2xDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDeEIsQ0FBQztJQUVELEtBQUssQ0FBQyxRQUFRO1FBQ1YsSUFBSSxPQUFPLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFbkQsSUFBSSxPQUFPLElBQUksSUFBSSxJQUFJLE9BQU8sQ0FBQyxNQUFNLElBQUksQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDO1lBQ25GLE9BQU8sQ0FBQyxHQUFHLENBQUMsdUJBQXVCLENBQUMsQ0FBQztZQUNyQyxPQUFPLElBQUksQ0FBQztRQUNoQixDQUFDO1FBRUQsSUFBSSxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxD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Q0FBQztZQUNoRSxDQUFDLENBQUMsQ0FBQztRQUNQLENBQUM7SUFDTCxDQUFDO0lBRUQsbUJBQW1CO0lBQ25CLGVBQWUsQ0FBQyxJQUFZO1FBQ3hCLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLGVBQUssQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUNwQyxPQUFPLEtBQUssQ0FBQztRQUNqQixDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQztJQUNELFdBQVc7SUFDWCxpQkFBaUIsQ0FBQyxJQUFZO1FBQzFCLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEtBQUssZUFBSyxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQy9DLE9BQU8sSUFBSSxDQUFDO1FBQ2hCLENBQUM7UUFDRCxPQUFPLEtBQUssQ0FBQztJQUNqQixDQUFDO0lBQ0QsZ0JBQWdCO0lBQ2hCLGNBQWMsQ0FBQyxJQUFZO1FBQ3ZCLElBQUksSUFBSSxLQUFLLElBQUksRUFBRSxDQUFDO1lBQ2hCLE9BQU8sRUFBRSxDQUFDO1FBQ2QsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQyxlQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUN2RSxDQUFDO0NBQ0osQ0FBQztBQUVGOzs7R0FHRztBQUNILFNBQWdCLElBQUksS0FBSyxDQUFDO0FBRTFCOzs7R0FHRztBQUNILFNBQWdCLE1BQU0sS0FBSyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9uZW50LCBkaXJlY3RvciwganMsIE5vZGUgfSBmcm9tICdjYyc7XHJcbmltcG9ydCBmcyBmcm9tIFwiZnNcIjtcclxuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XHJcbmltcG9ydCBwYWNrYWdlSlNPTiBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xyXG5pbXBvcnQgQ29uc3QgZnJvbSBcIi4vQ29uc3RcIjtcclxuXHJcbmNvbnN0IFByb2plY3RQYXRoID0gRWRpdG9yLlByb2plY3QucGF0aDtcclxuXHJcbi8vIOS4tOaXtuWcqOW9k+WJjeaooeWdl+WinuWKoOe8lui+keWZqOWGheeahOaooeWdl+S4uuaQnOe0oui3r+W+hO+8jOS4uuS6huiDveWkn+ato+W4uCByZXF1aXJlIOWIsCBjYyDmqKHlnZfvvIzlkI7nu63niYjmnKzlsIbkvJjljJbosIPnlKjmlrnlvI9cclxuLy8gbW9kdWxlLnBhdGhzLnB1c2goam9pbihFZGl0b3IuQXBwLnBhdGgsICdub2RlX21vZHVsZXMnKSk7XHJcblxyXG4vLyDlvZPliY3niYjmnKzpnIDopoHlnKggbW9kdWxlLnBhdGhzIOS/ruaUueWQjuaJjeiDveato+W4uOS9v+eUqCBjYyDmqKHlnZdcclxuLy8g5bm25LiU5aaC5p6c5biM5pyb5q2j5bi45pi+56S6IGNjIOeahOWumuS5ie+8jOmcgOimgeaJi+WKqOWwhiBlbmdpbmUg5paH5Lu25aS56YeM55qEIGNjLmQudHMg5re75Yqg5Yiw5o+S5Lu255qEIHRzY29uZmlnIOmHjFxyXG4vLyDlvZPliY3niYjmnKznmoQgY2Mg5a6a5LmJ5paH5Lu25Y+v5Lul5Zyo5b2T5YmN6aG555uu55qEIHRlbXAvZGVjbGFyYXRpb25zL2NjLmQudHMg5om+5YiwXHJcbi8vIGltcG9ydCB7IGRpcmVjdG9yIH0gZnJvbSAnY2MnO1xyXG5cclxuLyoqXHJcbiAqIEBlbiBSZWdpc3RyYXRpb24gbWV0aG9kIGZvciB0aGUgbWFpbiBwcm9jZXNzIG9mIEV4dGVuc2lvblxyXG4gKiBAemgg5Li65omp5bGV55qE5Li76L+b56iL55qE5rOo5YaM5pa55rOVXHJcbiAqL1xyXG5leHBvcnQgY29uc3QgbWV0aG9kczogeyBba2V5OiBzdHJpbmddOiAoLi4uYW55OiBhbnkpID0+IGFueSB9ID0ge1xyXG4gICAgLyoqXHJcbiAgICAgKiBAZW4gQSBtZXRob2QgdGhhdCBjYW4gYmUgdHJpZ2dlcmVkIGJ5IG1lc3NhZ2VcclxuICAgICAqIEB6aCDpgJrov4cgbWVzc2FnZSDop6blj5HnmoTmlrnms5VcclxuICAgICAqL1xyXG4gICAgc2hvd0xvZygpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnSGVsbG8gV29ybGQnKTtcclxuICAgIH0sXHJcblxyXG5cclxuICAgIGJpbmRSb290KCkge1xyXG4gICAgICAgIC8vQHRzLWlnbm9yZSBjY2Ug5rKh5om+5Yiw5pyJ5aOw5piOLOaJgOS7peatpOWkhOS9v+eUqHRz5b+955WlXHJcbiAgICAgICAgbGV0IE5vZGVSb290ID0gY2NlLlNjZW5lLnJvb3ROb2RlO1xyXG4gICAgICAgIHRoaXMuYmluZChOb2RlUm9vdCk7XHJcbiAgICB9LFxyXG5cclxuICAgIGFzeW5jIGJpbmROb2RlKCkge1xyXG4gICAgICAgIHZhciBub2RlSWRzID0gRWRpdG9yLlNlbGVjdGlvbi5nZXRTZWxlY3RlZCgnbm9kZScpO1xyXG5cclxuICAgICAgICBpZiAobm9kZUlkcyA9PSBudWxsIHx8IG5vZGVJZHMubGVuZ3RoID09IDAgfHwgbm9kZUlkc1swXSA9PSBudWxsIHx8IG5vZGVJZHNbMF0gPT0gXCJcIikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnUGxlYXNlIHNlbGVjdCBhIG5vZGUuJyk7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKG5vZGVJZHMubGVuZ3RoID4gMSkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnUGxlYXNlIHNlbGVjdCBvbmx5IG9uZSBub2RlLicpO1xyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKVxyXG4gICAgICAgIGlmIChzY2VuZSkge1xyXG4gICAgICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgbm9kZUlkcy5sZW5ndGg7IGluZGV4KyspIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGlkID0gbm9kZUlkc1tpbmRleF07XHJcbiAgICAgICAgICAgICAgICBsZXQgbm9kZSA9IHRoaXMuZmluZE5vZGVCeVVVSUQoaWQsIGRpcmVjdG9yLmdldFNjZW5lKCkpO1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5iaW5kKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgYXN5bmMgYmluZChOb2RlUm9vdDogTm9kZSkge1xyXG5cclxuICAgICAgICAvL0B0cy1pZ25vcmUgXHJcbiAgICAgICAgY29uc3QgY29tcCA9IE5vZGVSb290LmdldENvbXBvbmVudChhYi5Db21wb25lbnQpO1xyXG5cclxuICAgICAgICBpZiAoIWNvbXApIHtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKGAke05vZGVSb290Lm5hbWV9IOayoeacieaMgui9vSDnu6fmib/oh6pBQkNvbXBvbmVudCDohJrmnKxgKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGNvbmZpZ1BhdGggPSBwYXRoLmpvaW4oUHJvamVjdFBhdGgsIENvbnN0LkNvbmZpZ1VybCk7XHJcbiAgICAgICAgbGV0IGNvbmZpZyA9IENvbnN0LkRlZmF1bHRDb25maWc7XHJcbiAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoY29uZmlnUGF0aCkpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYOato+WcqOivu+WPlumFjee9ruaWh+S7tjogJHtQcm9qZWN0UGF0aH0vJHtDb25zdC5Db25maWdVcmx9IOivt+eojeetiS5gKTtcclxuICAgICAgICAgICAgbGV0IGNvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMoYCR7UHJvamVjdFBhdGh9LyR7Q29uc3QuQ29uZmlnVXJsfWAsIHsgZW5jb2Rpbmc6ICd1dGYtOCcgfSk7XHJcbiAgICAgICAgICAgIGlmICghY29udGVudCkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGDor7vlj5bphY3nva7mlofku7blpLHotKU6JHtQcm9qZWN0UGF0aH0vJHtDb25zdC5Db25maWdVcmx9YCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY29uZmlnID0gSlNPTi5wYXJzZShjb250ZW50KTtcclxuICAgICAgICB9XHJcblxyXG5cclxuICAgICAgICAvLyBAdHMtaWdub3JlXHJcbiAgICAgICAgY29uc3Qgc2NyaXB0VXVpZCA9IGNvbXAuX19zY3JpcHRVdWlkO1xyXG4gICAgICAgIGxldCBDb21wb25lbnRTY3JpcHRQYXRoID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktcGF0aCcsIHNjcmlwdFV1aWQpXHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKENvbXBvbmVudFNjcmlwdFBhdGgpO1xyXG5cclxuICAgICAgICBpZiAoQ29tcG9uZW50U2NyaXB0UGF0aCA9PSBudWxsIHx8IENvbXBvbmVudFNjcmlwdFBhdGgubGVuZ3RoIDw9IDApIHtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKGDojrflj5bnu4Tku7bot6/lvoTlpLHotKUhYCk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgQ29tcG9uZW50U2NyaXB0UGF0aCA9IENvbXBvbmVudFNjcmlwdFBhdGgucmVwbGFjZSgvXFxcXC9nLCBcIi9cIik7XHJcblxyXG4gICAgICAgIC8vIGxldCBQcm9qZWN0RGlyID0gRWRpdG9yLlByb2plY3QucGF0aDtcclxuICAgICAgICBsZXQgVUlDb21OYW1lID0gdGhpcy5nZXRBQkNvbXBvbmVudE5hbWUoTm9kZVJvb3QpO1xyXG4gICAgICAgIGlmIChVSUNvbU5hbWUgPT0gbnVsbCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYOacquaJvuWIsEFCQ29tcG9uZW5055qE57uE5Lu2IWApO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuXHJcbiAgICAgICAgbGV0IEF1dG9TY3JpcHROYW1lID0gYCR7VUlDb21OYW1lfV9BdXRvYDtcclxuICAgICAgICBsZXQgQXV0b1NjcmlwdFBhdGggPSBgYDtcclxuXHJcbiAgICAgICAgY29uc3QgZ2V0QXV0b1NjcmlwdFBhdGggPSAoY29uZmlnOiBhbnkpID0+IHtcclxuXHJcbiAgICAgICAgICAgIGxldCB0ZW1wUGF0aCA9IFwiXCI7XHJcblxyXG4gICAgICAgICAgICBsZXQgbWF0Y2hQYXRoID0gYCR7UHJvamVjdFBhdGh9LyR7Y29uZmlnLlJvb3REaXJ9YC5yZXBsYWNlKC9cXFxcL2csIFwiL1wiKVxyXG4gICAgICAgICAgICBpZiAoY29uZmlnLlNjcmlwdHNEaXIuc3RhcnRzV2l0aChcImFzc2V0cy9cIikpIHtcclxuICAgICAgICAgICAgICAgIG1hdGNoUGF0aCA9IGAke1Byb2plY3RQYXRofS8ke2NvbmZpZy5TY3JpcHRzRGlyfWAucmVwbGFjZSgvXFxcXC9nLCBcIi9cIilcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKENvbXBvbmVudFNjcmlwdFBhdGguc3RhcnRzV2l0aChtYXRjaFBhdGgpKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoY29uZmlnLlNjcmlwdHNEaXIuc3RhcnRzV2l0aChcImFzc2V0cy9cIikpIHtcclxuICAgICAgICAgICAgICAgICAgICB0ZW1wUGF0aCA9IGAke1Byb2plY3RQYXRofS8ke2NvbmZpZy5TY3JpcHRzRGlyfS8ke0NvbnN0LkF1dG9TY3JpcHRzRGlyTmFtZX0vJHtBdXRvU2NyaXB0TmFtZX0udHNgLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB0ZW1wUGF0aCA9IGAke1Byb2plY3RQYXRofS8ke2NvbmZpZy5Sb290RGlyfS8ke2NvbmZpZy5TY3JpcHRzRGlyfS8ke0NvbnN0LkF1dG9TY3JpcHRzRGlyTmFtZX0vJHtBdXRvU2NyaXB0TmFtZX0udHNgLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiB0ZW1wUGF0aDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvbmZpZykpIHtcclxuICAgICAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IGNvbmZpZy5sZW5ndGg7IGluZGV4KyspIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGVsZW1lbnQgPSBjb25maWdbaW5kZXhdO1xyXG4gICAgICAgICAgICAgICAgQXV0b1NjcmlwdFBhdGggPSBnZXRBdXRvU2NyaXB0UGF0aChlbGVtZW50KTtcclxuICAgICAgICAgICAgICAgIGlmIChBdXRvU2NyaXB0UGF0aCAhPSBcIlwiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBBdXRvU2NyaXB0UGF0aCA9IGdldEF1dG9TY3JpcHRQYXRoKGNvbmZpZyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoQXV0b1NjcmlwdFBhdGgubGVuZ3RoIDw9IDApIHtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKGDojrflj5bkv53lrZjot6/lvoTlpLHotKUs6K+35qOA5p+l6YWN572u5YaF5a65OiR7UHJvamVjdFBhdGh9LyR7Q29uc3QuQ29uZmlnVXJsfSFgKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcblxyXG4gICAgICAgIGxldCBub2RlTWFwczogeyBba2V5OiBzdHJpbmddOiBzdHJpbmdbXSB9ID0ge30sIGltcG9ydE1hcHM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7fTtcclxuICAgICAgICB0aGlzLmZpbmROb2RlcyhOb2RlUm9vdCwgbm9kZU1hcHMsIGltcG9ydE1hcHMsIHRydWUpO1xyXG5cclxuICAgICAgICBsZXQgX3N0cl9pbXBvcnQgPSBgYDtcclxuICAgICAgICBmb3IgKGxldCBrZXkgaW4gaW1wb3J0TWFwcykge1xyXG4gICAgICAgICAgICBfc3RyX2ltcG9ydCArPSBgaW1wb3J0ICR7a2V5fSBmcm9tIFwiJHt0aGlzLmdldEltcG9ydFBhdGgoaW1wb3J0TWFwc1trZXldLCBBdXRvU2NyaXB0UGF0aCl9XCJcXG5gO1xyXG4gICAgICAgIH1cclxuICAgICAgICBsZXQgX2NjX2NvbXBzOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgICAgIGxldCBfc3RyX2NvbnRlbnQgPSBgYDtcclxuICAgICAgICBmb3IgKGxldCBrZXkgaW4gbm9kZU1hcHMpIHtcclxuICAgICAgICAgICAgbGV0IHR5cGUgPSBub2RlTWFwc1trZXldWzBdO1xyXG4gICAgICAgICAgICBsZXQgYXJyID0gdHlwZS5zcGxpdChcIi5cIik7XHJcbiAgICAgICAgICAgIGlmIChhcnJbMF0gPT0gXCJjY1wiICYmIF9jY19jb21wcy5pbmRleE9mKGFyclsxXSkgPT0gLTEpIHtcclxuICAgICAgICAgICAgICAgIF9jY19jb21wcy5wdXNoKGFyclsxXSk7XHJcbiAgICAgICAgICAgICAgICB0eXBlID0gYXJyWzFdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIF9zdHJfY29udGVudCArPSBgXFx0QHByb3BlcnR5KCR7dHlwZX0pXFxuXFx0JHtrZXl9OiAke3R5cGV9IHwgbnVsbCA9IG51bGw7XFxuYDtcclxuICAgICAgICB9XHJcbiAgICAgICAgbGV0IF9zdHJfY2NfY29tcHMgPSBfY2NfY29tcHMubGVuZ3RoID4gMCA/ICcsICcgKyBfY2NfY29tcHMuam9pbihcIiwgXCIpIDogJyc7XHJcblxyXG4gICAgICAgIGxldCBzdHJTY3JpcHQgPSBgJHtfc3RyX2ltcG9ydH1cclxuaW1wb3J0IHsgX2RlY29yYXRvciwgQ29tcG9uZW50JHtfc3RyX2NjX2NvbXBzfSB9IGZyb20gJ2NjJztcclxuY29uc3QgeyBjY2NsYXNzLCBwcm9wZXJ0eSB9ID0gX2RlY29yYXRvcjtcclxuXHJcbkBjY2NsYXNzKFwiJHtBdXRvU2NyaXB0TmFtZX1cIilcclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgJHtBdXRvU2NyaXB0TmFtZX0gZXh0ZW5kcyBDb21wb25lbnQge1xyXG4ke19zdHJfY29udGVudH0gXHJcbn1gO1xyXG5cclxuICAgICAgICBsZXQgZGJTY3JpcHRQYXRoID0gQXV0b1NjcmlwdFBhdGgucmVwbGFjZShQcm9qZWN0UGF0aC5yZXBsYWNlKC9cXFxcL2csIFwiL1wiKSwgXCJkYjovXCIpO1xyXG4gICAgICAgIHRoaXMuc2F2ZUZpbGUoZGJTY3JpcHRQYXRoLCBzdHJTY3JpcHQpXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncmVmcmVzaC1hc3NldCcsIGRiU2NyaXB0UGF0aCk7XHJcblxyXG4gICAgICAgICAgICBsZXQgYXV0b0NvbXAgPSB0aGlzLmdldENvbXBvbmVudChOb2RlUm9vdCwgQXV0b1NjcmlwdE5hbWUpO1xyXG4gICAgICAgICAgICBpZiAoIWF1dG9Db21wKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzaG9ydGN1dHMgPSBwYWNrYWdlSlNPTi5jb250cmlidXRpb25zLnNob3J0Y3V0cy5tYXAodiA9PiB2Lndpbikuam9pbignIC8gJyk7XHJcbiAgICAgICAgICAgICAgICBpZiAoIWpzLmdldENsYXNzQnlOYW1lKEF1dG9TY3JpcHROYW1lKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuaW5mbyhg6K+35YaN5omn6KGM5LiA5qyhICR7c2hvcnRjdXRzfWApO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2NyZWF0ZS1jb21wb25lbnQnLCB7IHV1aWQ6IE5vZGVSb290LnV1aWQsIGNvbXBvbmVudDogQXV0b1NjcmlwdE5hbWUgfSk7XHJcbiAgICAgICAgICAgICAgICAvLyBhdXRvQ29tcCA9IHRoaXMuZ2V0Q29tcG9uZW50KE5vZGVSb290LCBBdXRvU2NyaXB0TmFtZSk7ICAvLyDihpHlubbkuI3kvJrlrp7ml7bpmYTliqDkuIrljrtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuaW5mbyhg6K+35YaN5omn6KGM5LiA5qyhICR7c2hvcnRjdXRzfWApO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBmb3IgKGxldCBrZXkgaW4gbm9kZU1hcHMpIHtcclxuXHJcbiAgICAgICAgICAgICAgICBsZXQgb3B0aW9ucyA9IHtcclxuICAgICAgICAgICAgICAgICAgICB1dWlkOiBOb2RlUm9vdC51dWlkLFxyXG4gICAgICAgICAgICAgICAgICAgIHBhdGg6IGBfX2NvbXBzX18uJHt0aGlzLmdldENvbXBvbmVudEluZGV4KE5vZGVSb290LCBBdXRvU2NyaXB0TmFtZSl9LiR7a2V5fWAsXHJcbiAgICAgICAgICAgICAgICAgICAgZHVtcDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBub2RlTWFwc1trZXldWzBdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXVpZDogbm9kZU1hcHNba2V5XVsxXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5kdW1wLnR5cGUgIT0gQ29uc3QuU2VwYXJhdG9yTWFwLk5vZGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgYXBwZW5kQ29tcCA9IHRoaXMuZ2V0Q29tcG9uZW50KHRoaXMuZmluZE5vZGVCeVVVSUQobm9kZU1hcHNba2V5XVsxXSwgTm9kZVJvb3QpLCBvcHRpb25zLmR1bXAudHlwZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFwcGVuZENvbXApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5kdW1wLnZhbHVlID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXVpZDogYXBwZW5kQ29tcC51dWlkXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIG9wdGlvbnMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKEF1dG9TY3JpcHROYW1lICsgJy50cyDnlJ/miJDmiJDlip8nKTtcclxuXHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgc2F2ZUZpbGUoU2NyaXB0UGF0aDogc3RyaW5nLCBzdHJTY3JpcHQ6IHN0cmluZykge1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShhc3luYyAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcblxyXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KFxyXG4gICAgICAgICAgICAgICAgJ2Fzc2V0LWRiJyxcclxuICAgICAgICAgICAgICAgICdjcmVhdGUtYXNzZXQnLFxyXG4gICAgICAgICAgICAgICAgU2NyaXB0UGF0aCxcclxuICAgICAgICAgICAgICAgIHN0clNjcmlwdCxcclxuICAgICAgICAgICAgICAgIHsgb3ZlcndyaXRlOiB0cnVlIH1cclxuICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgLy8gICBjb25zb2xlLmxvZygnY3JlYXRl4oCRb3LigJFzYXZlIOe7k+aenO+8micsIHJlc3VsdCk7XHJcbiAgICAgICAgICAgIHJlc29sdmUocmVzdWx0KTtcclxuICAgICAgICB9KTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqIOiuoeeul+ebuOWvuei3r+W+hCAqL1xyXG4gICAgZ2V0SW1wb3J0UGF0aChleHBvcnRQYXRoOiBzdHJpbmcsIGN1cnJQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgICAgIGV4cG9ydFBhdGggPSBleHBvcnRQYXRoLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpLnN1YnN0cigwLCBleHBvcnRQYXRoLmxhc3RJbmRleE9mKFwiLlwiKSk7XHJcbiAgICAgICAgY3VyclBhdGggPSBjdXJyUGF0aC5yZXBsYWNlKC9cXFxcL2csIFwiL1wiKTtcclxuICAgICAgICBsZXQgdG1wID0gXCIuL1wiO1xyXG4gICAgICAgIGxldCBzdGFydDogbnVtYmVyLCBlbmQ6IG51bWJlcjtcclxuICAgICAgICBsZXQgZXhwb3J0U3RyID0gZXhwb3J0UGF0aC5zcGxpdChcIi9cIik7XHJcbiAgICAgICAgbGV0IGN1cnJTdHIgPSBjdXJyUGF0aC5zcGxpdChcIi9cIik7XHJcbiAgICAgICAgZm9yIChlbmQgPSAwOyBlbmQgPCBleHBvcnRTdHIubGVuZ3RoOyArK2VuZCkge1xyXG4gICAgICAgICAgICBpZiAoZXhwb3J0U3RyW2VuZF0gIT0gY3VyclN0cltlbmRdKSB7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBmb3IgKHN0YXJ0ID0gZW5kICsgMTsgc3RhcnQgPCBjdXJyU3RyLmxlbmd0aDsgKytzdGFydCkge1xyXG4gICAgICAgICAgICB0bXAgKz0gXCIuLi9cIjtcclxuICAgICAgICB9XHJcbiAgICAgICAgZm9yIChzdGFydCA9IGVuZDsgc3RhcnQgPCBleHBvcnRTdHIubGVuZ3RoOyArK3N0YXJ0KSB7XHJcbiAgICAgICAgICAgIHRtcCArPSBgJHtleHBvcnRTdHJbc3RhcnRdfS9gO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0bXAgPSB0bXAuc3Vic3RyKDAsIHRtcC5sZW5ndGggLSAxKTtcclxuICAgICAgICByZXR1cm4gdG1wO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKiog6I635b6XQ29tcG9uZW5055qE57G75ZCNICovXHJcbiAgICBnZXRDb21wb25lbnROYW1lKGNvbTogQ29tcG9uZW50KTogc3RyaW5nIHtcclxuICAgICAgICBsZXQgYXJyID0gY29tLm5hbWUubWF0Y2goLzwuKj4kLyk7XHJcbiAgICAgICAgaWYgKGFyciAmJiBhcnIubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICByZXR1cm4gYXJyWzBdLnNsaWNlKDEsIC0xKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGNvbS5uYW1lO1xyXG4gICAgfSxcclxuXHJcbiAgICBnZXRBQkNvbXBvbmVudE5hbWUobm9kZTogTm9kZSkge1xyXG5cclxuICAgICAgICAvL0B0cy1pZ25vcmUgXHJcbiAgICAgICAgbGV0IGNvbXMgPSBub2RlLmdldENvbXBvbmVudHMoYWIuQ29tcG9uZW50KTtcclxuXHJcbiAgICAgICAgLy8g5LyY5YWI5Y+WVUnlvIDlpLTnmoTnu4Tku7ZcclxuICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgY29tcy5sZW5ndGg7IGluZGV4KyspIHtcclxuICAgICAgICAgICAgbGV0IG5hbWUgPSB0aGlzLmdldENvbXBvbmVudE5hbWUoY29tc1tpbmRleF0pO1xyXG4gICAgICAgICAgICBpZiAobmFtZSAmJiBuYW1lLnN0YXJ0c1dpdGgoXCJVSVwiKSAmJiAhbmFtZS5lbmRzV2l0aChcIl9BdXRvXCIpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbmFtZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g5om+5LiN5YiwVUnlvIDlpLTnmoTnu4Tku7ZcclxuICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgY29tcy5sZW5ndGg7IGluZGV4KyspIHtcclxuICAgICAgICAgICAgbGV0IG5hbWUgPSB0aGlzLmdldENvbXBvbmVudE5hbWUoY29tc1tpbmRleF0pO1xyXG4gICAgICAgICAgICBpZiAobmFtZSAmJiAhbmFtZS5lbmRzV2l0aChcIl9BdXRvXCIpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbmFtZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcblxyXG5cclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDojrflj5boioLngrnnmoTnu4Tku7ZcclxuICAgICAqIOino+WGs+WboOiwg+eUqCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWZyZXNoLWFzc2V0JyDlkI4g5bCG5peg5rOV6YCa6L+HY2PnmoRnZXRDb21wb25lbnTmnaXojrflvpfnu4Tku7ZcclxuICAgICAqL1xyXG4gICAgZ2V0Q29tcG9uZW50KG5vZGU6IE5vZGUsIG5hbWU6IGFueSkge1xyXG4gICAgICAgIGxldCBjb20gPSBudWxsO1xyXG4gICAgICAgIGlmICh0eXBlb2YgbmFtZSA9PSBcInN0cmluZ1wiKSB7XHJcbiAgICAgICAgICAgIGNvbSA9IG5vZGUuY29tcG9uZW50cy5maW5kKGl0ZW0gPT4gaXRlbS5uYW1lID09IGAke25vZGUubmFtZX08JHtuYW1lfT5gKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGNvbSA9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIGNvbSA9IG5vZGUuZ2V0Q29tcG9uZW50KG5hbWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gY29tO1xyXG4gICAgfSxcclxuICAgIC8qKlxyXG4gICAgICog6I635Y+W57uE5Lu25LiL5qCHXHJcbiAgICAgKiBAcGFyYW0gbm9kZSBcclxuICAgICAqIEBwYXJhbSBuYW1lIFxyXG4gICAgICogQHJldHVybnMgXHJcbiAgICAgKi9cclxuICAgIGdldENvbXBvbmVudEluZGV4KG5vZGU6IE5vZGUsIG5hbWU6IHN0cmluZykge1xyXG4gICAgICAgIGxldCBpbmRleCA9IG5vZGUuY29tcG9uZW50cy5maW5kSW5kZXgoaXRlbSA9PiBpdGVtLm5hbWUgPT0gYCR7bm9kZS5uYW1lfTwke25hbWV9PmApO1xyXG4gICAgICAgIHJldHVybiBpbmRleDtcclxuICAgIH0sXHJcblxyXG5cclxuICAgIGZpbmROb2RlQnlVVUlEKHV1aWQ6IHN0cmluZywgcm9vdE5vZGU6IE5vZGUpOiBhbnkge1xyXG4gICAgICAgIGlmIChyb290Tm9kZS51dWlkID09IHV1aWQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJvb3ROb2RlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByb290Tm9kZS5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBsZXQgbm9kZSA9IHRoaXMuZmluZE5vZGVCeVVVSUQodXVpZCwgcm9vdE5vZGUuY2hpbGRyZW5baV0pO1xyXG4gICAgICAgICAgICBpZiAobm9kZSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5vZGU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9LFxyXG5cclxuICAgIGFzeW5jIGZpbmROb2Rlcyhub2RlOiBOb2RlLCBfbm9kZU1hcHM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nW10gfSwgX2ltcG9ydE1hcHM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0sIGlzUm9vdDogYm9vbGVhbikge1xyXG4gICAgICAgIGxldCBuYW1lID0gbm9kZS5uYW1lO1xyXG4gICAgICAgIGlmICghaXNSb290ICYmIHRoaXMuY2hlY2tOb2RlUHJlZml4KG5hbWUpKSB7XHJcbiAgICAgICAgICAgIC8vIOiOt+W+l+i/meS4que7hOS7tueahOexu+WeiyDlkowg5ZCN56ewXHJcbiAgICAgICAgICAgIGxldCBuYW1lcyA9IHRoaXMuZ2V0UHJlZml4TmFtZXMobmFtZSk7XHJcbiAgICAgICAgICAgIGlmIChuYW1lcyA9PT0gbnVsbCB8fCBuYW1lcy5sZW5ndGggIT09IDIpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGAke25hbWV9IOWRveS7pOS4jeinhOiMgywg6K+35L2/55SoX0xhYmVsJHh4eOeahOagvOW8jyEsIOaIluiAheaYr+WcqFN5c0RlZmluZeS4reayoeacieWumuS5iWApO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGxldCB0eXBlID0gQ29uc3QuU2VwYXJhdG9yTWFwW25hbWVzWzBdXSB8fCBuYW1lc1swXTtcclxuICAgICAgICAgICAgbGV0IHZhbHVlID0gbmFtZXNbMV07XHJcbiAgICAgICAgICAgIGlmICh2YWx1ZS5lbmRzV2l0aChDb25zdC5TVEFOREFSRF9FbmQpKSB7XHJcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHZhbHVlLnN1YnN0cmluZygwLCB2YWx1ZS5sZW5ndGggLSBDb25zdC5TVEFOREFSRF9FbmQubGVuZ3RoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8g6L+b5YWl5Yiw6L+Z6YeM77yMIOWwseihqOekuuWPr+S7pee7keWumuS6hlxyXG4gICAgICAgICAgICBpZiAoX25vZGVNYXBzW3ZhbHVlXSkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCLlh7rnjrDkuobph43lkI3lrZfmrrU6XCIsIHZhbHVlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBfbm9kZU1hcHNbdmFsdWVdID0gW3R5cGUsIG5vZGUudXVpZF07XHJcblxyXG4gICAgICAgICAgICAvLyDmo4Dmn6XmmK/lkKbmmK/oh6rlrprkuYnnu4Tku7ZcclxuICAgICAgICAgICAgbGV0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudCh0eXBlKTtcclxuICAgICAgICAgICAgaWYgKCFfaW1wb3J0TWFwc1t0eXBlXSAmJiB0eXBlLmluZGV4T2YoXCJjYy5cIikgPT09IC0xICYmIGNvbXApIHtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBAdHMtaWdub3JlXHJcbiAgICAgICAgICAgICAgICBjb25zdCBzY3JpcHRVdWlkID0gY29tcC5fX3NjcmlwdFV1aWQ7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBpbmZvID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIHNjcmlwdFV1aWQpO1xyXG4gICAgICAgICAgICAgICAgaWYgKGluZm8pIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZygn6LWE5rqQIFVSTDonLCBpbmZvLnVybCk7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNvbXBvbmVudFBhdGggPSBpbmZvLnVybDtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50UGF0aCA9IGNvbXBvbmVudFBhdGgucmVwbGFjZSgvXFxzKi9nLCBcIlwiKS5yZXBsYWNlKC9cXFxcL2csIFwiL1wiKTtcclxuICAgICAgICAgICAgICAgICAgICBfaW1wb3J0TWFwc1t0eXBlXSA9IGNvbXBvbmVudFBhdGg7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChpc1Jvb3QgfHwgdGhpcy5jaGVja0JpbmRDaGlsZHJlbihuYW1lKSkge1xyXG4gICAgICAgICAgICAvLyDnu5HlrprlrZDoioLngrlcclxuICAgICAgICAgICAgbm9kZS5jaGlsZHJlbi5mb3JFYWNoKGFzeW5jICh0YXJnZXQ6IE5vZGUpID0+IHtcclxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuZmluZE5vZGVzKHRhcmdldCwgX25vZGVNYXBzLCBfaW1wb3J0TWFwcywgZmFsc2UpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKiDmo4DmtYvliY3nvIDmmK/lkKbnrKblkIjnu5Hlrprop4TojIMgKi9cclxuICAgIGNoZWNrTm9kZVByZWZpeChuYW1lOiBzdHJpbmcpIHtcclxuICAgICAgICBpZiAobmFtZVswXSAhPT0gQ29uc3QuU1RBTkRBUkRfUHJlZml4KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9LFxyXG4gICAgLyoqIOajgOafpeWQjue8gCAqL1xyXG4gICAgY2hlY2tCaW5kQ2hpbGRyZW4obmFtZTogc3RyaW5nKSB7XHJcbiAgICAgICAgaWYgKG5hbWVbbmFtZS5sZW5ndGggLSAxXSAhPT0gQ29uc3QuU1RBTkRBUkRfRW5kKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9LFxyXG4gICAgLyoqIOiOt+W+l+exu+Wei+WSjG5hbWUgKi9cclxuICAgIGdldFByZWZpeE5hbWVzKG5hbWU6IHN0cmluZykge1xyXG4gICAgICAgIGlmIChuYW1lID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAnJztcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG5hbWUuc3Vic3RyKDEsIG5hbWUubGVuZ3RoKS5zcGxpdChDb25zdC5TVEFOREFSRF9TZXBhcmF0b3IpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIEBlbiBNZXRob2QgVHJpZ2dlcmVkIG9uIEV4dGVuc2lvbiBTdGFydHVwXHJcbiAqIEB6aCDmianlsZXlkK/liqjml7bop6blj5HnmoTmlrnms5VcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBsb2FkKCkgeyB9XHJcblxyXG4vKipcclxuICogQGVuIE1ldGhvZCB0cmlnZ2VyZWQgd2hlbiB1bmluc3RhbGxpbmcgdGhlIGV4dGVuc2lvblxyXG4gKiBAemgg5Y246L295omp5bGV5pe26Kem5Y+R55qE5pa55rOVXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gdW5sb2FkKCkgeyB9XHJcbiJdfQ==