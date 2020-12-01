"use strict";

export function getDeviceType() {
    const ua = navigator.userAgent;
    if (ua.indexOf('iPhone') >= 0 || ua.indexOf('iPod') >= 0 ||
        ua.indexOf('Android') >= 0 && ua.indexOf('Mobile') >= 0)
    {
        return "mobile";
    } else if (ua.indexOf('iPad') >= 0 || ua.indexOf('Android') >= 0) {
        return "tablet";
    }
    return "pc";
}
const UserAgentUtil = {
    getDeviceType
};
export default UserAgentUtil;
module.exports = UserAgentUtil;
