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
    /** 遍历resources/forms */
    async generate() {
        const options = {
            name: package_json_1.default.name,
            method: 'generate',
            args: [],
        };
        const result = await Editor.Message.request('scene', 'execute-scene-script', options);
    },
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NvdXJjZS9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQXVDQSxvQkFBMEI7QUFNMUIsd0JBQTRCO0FBNUM1QixtRUFBMEM7QUFFMUM7OztHQUdHO0FBQ1UsUUFBQSxPQUFPLEdBQTRDO0lBQzVEOzs7T0FHRztJQUNILE9BQU87UUFDSCxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFHRCx3QkFBd0I7SUFDeEIsS0FBSyxDQUFDLFFBQVE7UUFDVixNQUFNLE9BQU8sR0FBb0M7WUFDN0MsSUFBSSxFQUFFLHNCQUFXLENBQUMsSUFBSTtZQUN0QixNQUFNLEVBQUUsVUFBVTtZQUNsQixJQUFJLEVBQUUsRUFBRTtTQUNYLENBQUM7UUFFRixNQUFNLE1BQU0sR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUN2QyxPQUFPLEVBQ1Asc0JBQXNCLEVBQ3RCLE9BQU8sQ0FDVixDQUFDO0lBQ04sQ0FBQztDQUdKLENBQUM7QUFFRjs7O0dBR0c7QUFDSCxTQUFnQixJQUFJLEtBQUssQ0FBQztBQUUxQjs7O0dBR0c7QUFDSCxTQUFnQixNQUFNLEtBQUssQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV4ZWN1dGVTY2VuZVNjcmlwdE1ldGhvZE9wdGlvbnMgfSBmcm9tICdAY29jb3MvY3JlYXRvci10eXBlcy9lZGl0b3IvcGFja2FnZXMvc2NlbmUvQHR5cGVzL3B1YmxpYyc7XHJcbmltcG9ydCBwYWNrYWdlSlNPTiBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xyXG5cclxuLyoqXHJcbiAqIEBlbiBSZWdpc3RyYXRpb24gbWV0aG9kIGZvciB0aGUgbWFpbiBwcm9jZXNzIG9mIEV4dGVuc2lvblxyXG4gKiBAemgg5Li65omp5bGV55qE5Li76L+b56iL55qE5rOo5YaM5pa55rOVXHJcbiAqL1xyXG5leHBvcnQgY29uc3QgbWV0aG9kczogeyBba2V5OiBzdHJpbmddOiAoLi4uYW55OiBhbnkpID0+IGFueSB9ID0ge1xyXG4gICAgLyoqXHJcbiAgICAgKiBAZW4gQSBtZXRob2QgdGhhdCBjYW4gYmUgdHJpZ2dlcmVkIGJ5IG1lc3NhZ2VcclxuICAgICAqIEB6aCDpgJrov4cgbWVzc2FnZSDop6blj5HnmoTmlrnms5VcclxuICAgICAqL1xyXG4gICAgc2hvd0xvZygpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnSGVsbG8gV29ybGQnKTtcclxuICAgIH0sXHJcblxyXG5cclxuICAgIC8qKiDpgY3ljoZyZXNvdXJjZXMvZm9ybXMgKi9cclxuICAgIGFzeW5jIGdlbmVyYXRlKCkge1xyXG4gICAgICAgIGNvbnN0IG9wdGlvbnM6IEV4ZWN1dGVTY2VuZVNjcmlwdE1ldGhvZE9wdGlvbnMgPSB7XHJcbiAgICAgICAgICAgIG5hbWU6IHBhY2thZ2VKU09OLm5hbWUsXHJcbiAgICAgICAgICAgIG1ldGhvZDogJ2dlbmVyYXRlJyxcclxuICAgICAgICAgICAgYXJnczogW10sXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdChcclxuICAgICAgICAgICAgJ3NjZW5lJyxcclxuICAgICAgICAgICAgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0JyxcclxuICAgICAgICAgICAgb3B0aW9uc1xyXG4gICAgICAgICk7XHJcbiAgICB9LFxyXG5cclxuXHJcbn07XHJcblxyXG4vKipcclxuICogQGVuIE1ldGhvZCBUcmlnZ2VyZWQgb24gRXh0ZW5zaW9uIFN0YXJ0dXBcclxuICogQHpoIOaJqeWxleWQr+WKqOaXtuinpuWPkeeahOaWueazlVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGxvYWQoKSB7IH1cclxuXHJcbi8qKlxyXG4gKiBAZW4gTWV0aG9kIHRyaWdnZXJlZCB3aGVuIHVuaW5zdGFsbGluZyB0aGUgZXh0ZW5zaW9uXHJcbiAqIEB6aCDljbjovb3mianlsZXml7bop6blj5HnmoTmlrnms5VcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiB1bmxvYWQoKSB7IH1cclxuXHJcbiJdfQ==