"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeviceType = void 0;
function getDeviceType() {
    const ua = navigator.userAgent;
    if (ua.indexOf('iPhone') >= 0 || ua.indexOf('iPod') >= 0 ||
        ua.indexOf('Android') >= 0 && ua.indexOf('Mobile') >= 0) {
        return "mobile";
    }
    else if (ua.indexOf('iPad') >= 0 || ua.indexOf('Android') >= 0) {
        return "tablet";
    }
    return "pc";
}
exports.getDeviceType = getDeviceType;
const UserAgentUtil = {
    getDeviceType
};
exports.default = UserAgentUtil;
module.exports = UserAgentUtil;
//# sourceMappingURL=user-agent-util.js.map