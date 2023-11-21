import { strings } from './english';

export type MessageId = keyof typeof strings;
// A quick localization hack. I'm not sure I'll ever actually localize these strings but it's not hard to add
// now and will (potentially) avoid a bunch of find/replace later
export function _T(key: MessageId) {
    return strings[key];
}
