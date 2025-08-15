
import { _decorator, Layout, tween, UIOpacity, UITransform } from 'cc';
import CocosHelper from '../UIFrame/CocosHelper';
import ToastMgr from '../UIFrame/ToastMgr';
import { UIToastBase } from '../UIFrame/UIForm';
import UIToast_Auto from './AutoScripts/UIToast_Auto';
const { ccclass, property } = _decorator;

@ccclass('UIToast')
export class UIToast extends UIToastBase {

    // modalType = new ModalType(ModalOpacity.OpacityHalf);
    public view: UIToast_Auto | null = null;

    public onAfterShow(params: any): void {

        let duration = 1;
        let text = "";

        //增加参数可以控制时长关闭

        if (typeof params == 'object') {
            duration = params.duration || 1;
            text = params.text || "";
        } else {
            text = params;
        }

        this.view.RichText.string = text;

        let txtTrans = this.view.RichText.getComponent(UITransform)
        let bgLayout = this.view.bg.getComponent(Layout);
        let bgTrans = this.view.bg.getComponent(UITransform);


        if (txtTrans.width <= 200) {
            bgLayout.enabled = false;
            // bgTrans.setContentSize(200, bgTrans.height)
            bgTrans.width = 200;
        } else {
            bgLayout.enabled = true;
        }

        this.scheduleOnce(() => {
            ToastMgr.close(this);
        }, duration);
    }

    public onHide(): void { }

    public async showEffect(): Promise<void> {

        let uiOpacity = this.getComponent(UIOpacity);
        uiOpacity.opacity = 255;
    }

    public async hideEffect(): Promise<void> {
        let uiOpacity = this.getComponent(UIOpacity);
        await CocosHelper.runTweenSync(uiOpacity, tween().to(1, { opacity: 0 }));
    }

    // update (dt) {}
}
