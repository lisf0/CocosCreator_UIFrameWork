
import { _decorator, Component, Sprite, RichText } from 'cc';
const { ccclass, property } = _decorator;

@ccclass("UIToast_Auto")
export default class UIToast_Auto extends Component {
	@property(Sprite)
	bg: Sprite | null = null;
	@property(RichText)
	RichText: RichText | null = null;
 
}