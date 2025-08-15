
import { _decorator, Component, Sprite, Label } from 'cc';
const { ccclass, property } = _decorator;

@ccclass("UILoading_Auto")
export default class UILoading_Auto extends Component {
	@property(Sprite)
	black: Sprite | null = null;
	@property(Label)
	text: Label | null = null;
	@property(Sprite)
	loading: Sprite | null = null;
 
}