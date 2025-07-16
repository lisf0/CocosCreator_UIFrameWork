
import { _decorator, Component, Node, Sprite, Button } from 'cc';
const { ccclass, property } = _decorator;
@ccclass("UIHome_Auto")
export default class UIHome_Auto extends Component {
	@property(Node)
	tnode: Node | null = null;
	@property(Sprite)
	splash: Sprite | null = null;
	@property(Button)
	button: Button | null = null;
 
}