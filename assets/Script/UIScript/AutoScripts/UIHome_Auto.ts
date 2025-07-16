

import * as cc from 'cc';
const { ccclass, property } = cc._decorator;
@ccclass("UIHome_Auto")
export default class UIHome_Auto extends cc.Component {
	@property(cc.Node)
	tnode: cc.Node | null = null;
	@property(cc.Sprite)
	splash: cc.Sprite | null = null;
 
}