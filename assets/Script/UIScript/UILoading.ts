
import { _decorator, easing, tween, UIOpacity, UITransform, view } from 'cc';
import CocosHelper from '../UIFrame/CocosHelper';
import { UITipsBase } from '../UIFrame/UIForm';
import UILoading_Auto from './AutoScripts/UILoading_Auto';
const { ccclass, property } = _decorator;

@ccclass('UILoading')
export class UILoading extends UITipsBase {

    // modalType = new ModalType(ModalOpacity.OpacityHalf);
    public view: UILoading_Auto | null = null;
    blackInitOpacity: number = 255;
    async onInit(params: any) {
        let size = view.getVisibleSize();
        this.view.black.getComponent(UITransform).height = size.height;
        this.view.black.getComponent(UITransform).width = size.width;
        this.blackInitOpacity = this.view.black.getComponent(UIOpacity).opacity;
        this.setBlockInput(true);
    }
    public onShow(params: any): void {

        this.view.black.getComponent(UIOpacity).opacity = this.blackInitOpacity;
        if (params != null && params.black != null) {
            this.view.black.getComponent(UIOpacity).opacity = params.black;
        }

        // this.view.Str.string = params;
        CocosHelper.runRepeatTweenSync(
            this.view.loading.node,
            -1, tween()
                .to(2, { angle: -360 }, { easing: easing.quintOut })
                .call(() => {
                    this.view.loading.node.angle = 0;
                })
        );
    }

    public onHide(params: any): void {
        this.view.loading.node.angle = 0;
        CocosHelper.stopTween(this.view.loading.node);
    }

    async showEffect() { }
    async hideEffect() { }

}
