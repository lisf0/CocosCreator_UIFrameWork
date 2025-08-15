import * as cc from "cc";
import { IPool } from "../Common/Utils/Pool";
import CocosHelper from "./CocosHelper";
import { FormType, ModalOpacity } from "./config/SysDefine";
import FormMgr from "./FormMgr";
import { ECloseType, ModalType } from "./Struct";
import UIBase from "./UIBase";


export class UIScreenBase extends UIBase {
    formType = FormType.Screen;
    closeType = ECloseType.CloseAndDestory;
}

export class UIWindowBase extends UIBase {
    formType = FormType.Window;
    modalType = new ModalType(ModalOpacity.OpacityFull);                // 阴影类型
    closeType = ECloseType.LRU;

    /** 显示效果 */
    public async showEffect() {
        this.node.setScale(cc.v3(0, 0, 1));
        await CocosHelper.runTweenSync(this.node, cc.tween().to(0.3, { scale: new cc.Vec3(1, 1, 1) }, { easing: cc.easing.backOut }));
    }
}

export class UIFixedBase extends UIBase {
    formType = FormType.Fixed;
    closeType = ECloseType.LRU;
}

export class UITipsBase extends UIBase {
    formType = FormType.Tips;
    closeType = ECloseType.CloseAndHide;
}

export class UIToastBase extends UIBase implements IPool {
    formType = FormType.Toast;

    public use() {

    }

    public free() {
    }

    public async closeSelf(): Promise<boolean> {
        let arr = this.fid.split("-");
        const bundleName = arr[0];
        const prefabUrl = arr[1];
        return await FormMgr.close({ bundleName, prefabUrl, type: this.formType });
    }
}


// @ts-ignore
ab.UIScreen = UIScreenBase;
// @ts-ignore
ab.UIWindow = UIWindowBase;
// @ts-ignore
ab.UIFixed = UIFixedBase;
// @ts-ignore
ab.UITips = UITipsBase;
// @ts-ignore
ab.UIToast = UIToastBase;
