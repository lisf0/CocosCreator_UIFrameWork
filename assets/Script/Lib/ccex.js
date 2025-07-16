if (!cc.Button.prototype.addClick) {
    Object.defineProperty(cc.Button.prototype, 'addClick', {
        value: function (callback, target) {
            this.node.off("click");
            this.node.on("click", callback, target);
        },
        enumerable: false, // 设置为不可枚举
        writable: true, // 设置为可写
        configurable: true // 设置为可配置
    });

    cc.log("[ccex] addClick to cc.Button success.");
}

