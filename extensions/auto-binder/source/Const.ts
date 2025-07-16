export default class Const {
    static ConfigUrl = "extensions/auto-config/config.json"
    static DefaultConfig = {    // 默认的配置,如果有文件配置↑ 则会取文件配置里的
        bundle: "resources",
        RootDir: "assets/resources",
        ScriptsDir: "assets/Script/UIScript",
        ScriptsName: "UIConfig.ts",
        FormsDir: "Prefab/Forms"
    }
    /** 规范符号 */
    static AutoScriptsDirName = "AutoScripts";              // 代码生成路径
    static STANDARD_Prefix = '_';                           // 绑定前缀
    static STANDARD_Separator = '$';                        // 分隔符
    static STANDARD_End = '#';                              // 绑定后缀, 结点添加此后缀后, 不会查询其子节点


    static SeparatorMap: { [key: string]: string } = {        // 名称以及对于的类型
        "Node": "cc.Node",
        "Label": "cc.Label",
        "Button": "cc.Button",
        "Sprite": "cc.Sprite",
        "RichText": "cc.RichText",
        "Mask": "cc.Mask",
        "MotionStreak": "cc.MotionStreak",
        "TiledMap": "cc.TiledMap",
        "TiledTile": "cc.TiledTile",
        "Spine": "cc.Skeleton",
        "Graphics": "cc.Graphics",
        "Animation": "cc.Animation",
        "WebView": "cc.WebView",
        "EditBox": "cc.EditBox",
        "ScrollView": "cc.ScrollView",
        "VideoPlayer": "cc.VideoPlayer",
        "ProgressBar": "cc.ProgressBar",
        "PageView": "cc.PageView",
        "Slider": "cc.Slider",
        "Toggle": "cc.Toggle",
        "ToggleContainer": "cc.ToggleContainer",
        // "ButtonPlus": "ButtonPlus",
        "Layout": "cc.Layout",
        "Widget": "cc.Widget",
    };
}
