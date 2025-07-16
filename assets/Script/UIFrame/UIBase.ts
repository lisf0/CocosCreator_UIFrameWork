import * as cc from "cc";

import AdapterMgr from "./AdapterMgr";
import CocosHelper from "./CocosHelper";
import { FormType } from "./config/SysDefine";
import ResMgr from "./ResMgr";
import { ECloseType, GetForm, IFormConfig, IFormData } from "./Struct";

//@ts-ignore
window["ab"] = {};

/**
 * 自动绑定组件的基类
 */
export class ABComponent extends cc.Component {
    /** 是否已经调用过preinit方法 */
    protected _inited = false;
    public view: cc.Component | null = null;

    /** 可以在这里进行一些资源的加载, 具体实现可以看test下的代码 */
    public async load(params: any) {
        return null;
    }

    protected getView() {
        let coms = this.getComponents(cc.Component);
        for (let index = 0; index < coms.length; index++) {
            let name = CocosHelper.getComponentName(coms[index]);
            if (name.endsWith("_Auto")) {
                return coms[index];
            }
        }

        return this.getComponent(`${this.node.name}_Auto`);
    }

    /** 预先初始化 */
    public async _preInit(params: any) {
        if (this._inited) return;
        this._inited = true;
        this.view = this.getView();
        // 加载这个UI依赖的其他资源
        let errorMsg = await this.load(params);
        if (errorMsg) {
            cc.error(errorMsg);
            return false;
        }
        await this.onInit(params);
        return true;
    }

    /** 初始化, 只调用一次 */
    public async onInit(params: any) { }
}

//@ts-ignore
window["ab"]["Component"] = ABComponent;

export default class UIBase extends ABComponent {
    /** 窗体id,该窗体的唯一标示(请不要对这个值进行赋值操作, 内部已经实现了对应的赋值) */
    public fid: string = '';
    /** 窗体数据 */
    public formData?: IFormData;
    /** 窗体类型 */
    public formType?: FormType;
    /** 关闭类型, 关闭窗口后销毁, 会将其依赖的资源一并销毁, 采用了引用计数的管理, 不用担心会影响其他窗体 */
    public closeType: ECloseType | null = null;;
    /** 是否已经调用过preinit方法 */
    // private _inited = false;

    // public view: cc.Component | null = null;

    public static UIConfig: IFormConfig | null = null;

    public static open(param?: any, formData?: IFormData) {
        let uiconfig = this.UIConfig;
        if (!uiconfig) {
            cc.warn(`sorry UIConfig is null, please check AutoConfig`);
            return;
        }
        //@ts-ignore 避免循环引用
        const FormMgr = window["FormMgr"];
        FormMgr.open(uiconfig, param, formData);
    }
    public static close() {
        if (this.UIConfig) {
            //@ts-ignore 避免循环引用
            const FormMgr = window["FormMgr"];
            FormMgr.close(this.UIConfig);
        }
    }
    /** 预先初始化 */
    public async _preInit(params: any) {
        if (this._inited) return;
        this._inited = true;
        this.view = this.getView();
        // 加载这个UI依赖的其他资源
        let errorMsg = await this.load(params);
        if (errorMsg) {
            cc.error(errorMsg);
            this.closeSelf();
            return false;
        }
        this.onInit(params);
        return true;
    }

    model: any = null;

    /** 可以在这里进行一些资源的加载, 具体实现可以看test下的代码 */
    public async load(params: any) {
        return null;
    }

    /** 初始化, 只调用一次 */
    // public onInit(params: any) { }
    // 显示回调
    public onShow(params: any) { }
    // 在显示动画结束后回调
    public onAfterShow(params: any) { }
    // 隐藏回调
    public onHide(params: any) { }
    // 在隐藏动画结束后回调
    public onAfterHide(params: any) { }

    // 关闭自己
    public async closeSelf(params?: any): Promise<boolean> {
        //@ts-ignore 避免循环引用
        const FormMgr = window["FormMgr"];
        return FormMgr.close(GetForm(this.fid, this.formType), params);
    }

    /**
     * 弹窗动画
     */
    public async showEffect() { }
    public async hideEffect() { }

    /** 设置是否挡住触摸事件 */
    private _blocker: cc.BlockInputEvents | null = null;
    public setBlockInput(block: boolean) {
        if (!this._blocker) {
            let node = new cc.Node('block_input_events');
            this._blocker = node.addComponent(cc.BlockInputEvents);
            let trans = node.getComponent(cc.UITransform);
            if (!trans) trans = node.addComponent(cc.UITransform);
            if (AdapterMgr.inst.visibleSize) trans.setContentSize(AdapterMgr.inst.visibleSize);
            this.node.insertChild(this._blocker.node, 9999);
        }
        this._blocker.node.active = block;
    }

    public async loadRes(url: string, type?: typeof cc.Asset) {
        return await ResMgr.inst.loadDynamicRes(url, type || cc.Asset, this.fid);
    }
}

// @ts-ignore
window["ab"]["UIBase"] = UIBase;