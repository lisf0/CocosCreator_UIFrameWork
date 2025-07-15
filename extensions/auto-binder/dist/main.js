"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
exports.load = load;
exports.unload = unload;
const package_json_1 = __importDefault(require("../package.json"));
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
    async bindRoot() {
        const options = {
            name: package_json_1.default.name,
            method: 'bindRoot',
            args: [],
        };
        const result = await Editor.Message.request('scene', 'execute-scene-script', options);
        // console.log('返回值：', result); // { result: 3 }
    },
    async bindNode() {
        const options = {
            name: package_json_1.default.name,
            method: 'bindNode',
            args: [],
        };
        const result = await Editor.Message.request('scene', 'execute-scene-script', options);
        // console.log('返回值：', result); // { result: 3 }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NvdXJjZS9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQXFEQSxvQkFBMEI7QUFNMUIsd0JBQTRCO0FBMUQ1QixtRUFBMEM7QUFFMUM7OztHQUdHO0FBQ1UsUUFBQSxPQUFPLEdBQTRDO0lBQzVEOzs7T0FHRztJQUNILE9BQU87UUFDSCxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFFRCxLQUFLLENBQUMsUUFBUTtRQUVWLE1BQU0sT0FBTyxHQUFvQztZQUM3QyxJQUFJLEVBQUUsc0JBQVcsQ0FBQyxJQUFJO1lBQ3RCLE1BQU0sRUFBRSxVQUFVO1lBQ2xCLElBQUksRUFBRSxFQUFFO1NBQ1gsQ0FBQztRQUVGLE1BQU0sTUFBTSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQ3ZDLE9BQU8sRUFDUCxzQkFBc0IsRUFDdEIsT0FBTyxDQUNWLENBQUM7UUFDRixnREFBZ0Q7SUFDcEQsQ0FBQztJQUVELEtBQUssQ0FBQyxRQUFRO1FBQ1YsTUFBTSxPQUFPLEdBQW9DO1lBQzdDLElBQUksRUFBRSxzQkFBVyxDQUFDLElBQUk7WUFDdEIsTUFBTSxFQUFFLFVBQVU7WUFDbEIsSUFBSSxFQUFFLEVBQUU7U0FDWCxDQUFDO1FBRUYsTUFBTSxNQUFNLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FDdkMsT0FBTyxFQUNQLHNCQUFzQixFQUN0QixPQUFPLENBQ1YsQ0FBQztRQUNGLGdEQUFnRDtJQUNwRCxDQUFDO0NBRUosQ0FBQztBQUVGOzs7R0FHRztBQUNILFNBQWdCLElBQUksS0FBSyxDQUFDO0FBRTFCOzs7R0FHRztBQUNILFNBQWdCLE1BQU0sS0FBSyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXhlY3V0ZVNjZW5lU2NyaXB0TWV0aG9kT3B0aW9ucyB9IGZyb20gJ0Bjb2Nvcy9jcmVhdG9yLXR5cGVzL2VkaXRvci9wYWNrYWdlcy9zY2VuZS9AdHlwZXMvcHVibGljJztcclxuaW1wb3J0IHBhY2thZ2VKU09OIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XHJcblxyXG4vKipcclxuICogQGVuIFJlZ2lzdHJhdGlvbiBtZXRob2QgZm9yIHRoZSBtYWluIHByb2Nlc3Mgb2YgRXh0ZW5zaW9uXHJcbiAqIEB6aCDkuLrmianlsZXnmoTkuLvov5vnqIvnmoTms6jlhozmlrnms5VcclxuICovXHJcbmV4cG9ydCBjb25zdCBtZXRob2RzOiB7IFtrZXk6IHN0cmluZ106ICguLi5hbnk6IGFueSkgPT4gYW55IH0gPSB7XHJcbiAgICAvKipcclxuICAgICAqIEBlbiBBIG1ldGhvZCB0aGF0IGNhbiBiZSB0cmlnZ2VyZWQgYnkgbWVzc2FnZVxyXG4gICAgICogQHpoIOmAmui/hyBtZXNzYWdlIOinpuWPkeeahOaWueazlVxyXG4gICAgICovXHJcbiAgICBzaG93TG9nKCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdIZWxsbyBXb3JsZCcpO1xyXG4gICAgfSxcclxuXHJcbiAgICBhc3luYyBiaW5kUm9vdCgpIHtcclxuXHJcbiAgICAgICAgY29uc3Qgb3B0aW9uczogRXhlY3V0ZVNjZW5lU2NyaXB0TWV0aG9kT3B0aW9ucyA9IHtcclxuICAgICAgICAgICAgbmFtZTogcGFja2FnZUpTT04ubmFtZSxcclxuICAgICAgICAgICAgbWV0aG9kOiAnYmluZFJvb3QnLFxyXG4gICAgICAgICAgICBhcmdzOiBbXSxcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KFxyXG4gICAgICAgICAgICAnc2NlbmUnLFxyXG4gICAgICAgICAgICAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLFxyXG4gICAgICAgICAgICBvcHRpb25zXHJcbiAgICAgICAgKTtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZygn6L+U5Zue5YC877yaJywgcmVzdWx0KTsgLy8geyByZXN1bHQ6IDMgfVxyXG4gICAgfSxcclxuXHJcbiAgICBhc3luYyBiaW5kTm9kZSgpIHtcclxuICAgICAgICBjb25zdCBvcHRpb25zOiBFeGVjdXRlU2NlbmVTY3JpcHRNZXRob2RPcHRpb25zID0ge1xyXG4gICAgICAgICAgICBuYW1lOiBwYWNrYWdlSlNPTi5uYW1lLFxyXG4gICAgICAgICAgICBtZXRob2Q6ICdiaW5kTm9kZScsXHJcbiAgICAgICAgICAgIGFyZ3M6IFtdLFxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoXHJcbiAgICAgICAgICAgICdzY2VuZScsXHJcbiAgICAgICAgICAgICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsXHJcbiAgICAgICAgICAgIG9wdGlvbnNcclxuICAgICAgICApO1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCfov5Tlm57lgLzvvJonLCByZXN1bHQpOyAvLyB7IHJlc3VsdDogMyB9XHJcbiAgICB9XHJcblxyXG59O1xyXG5cclxuLyoqXHJcbiAqIEBlbiBNZXRob2QgVHJpZ2dlcmVkIG9uIEV4dGVuc2lvbiBTdGFydHVwXHJcbiAqIEB6aCDmianlsZXlkK/liqjml7bop6blj5HnmoTmlrnms5VcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBsb2FkKCkgeyB9XHJcblxyXG4vKipcclxuICogQGVuIE1ldGhvZCB0cmlnZ2VyZWQgd2hlbiB1bmluc3RhbGxpbmcgdGhlIGV4dGVuc2lvblxyXG4gKiBAemgg5Y246L295omp5bGV5pe26Kem5Y+R55qE5pa55rOVXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gdW5sb2FkKCkgeyB9XHJcblxyXG4iXX0=