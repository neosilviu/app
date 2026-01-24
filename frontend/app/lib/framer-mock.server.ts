import React from 'react';

/**
 * FRAMER MOTION MOCK - Level 8 Striping
 */

const Dummy = ({ children }: any) => children;

export const motion = new Proxy({}, {
  get: () => (props: any) => React.createElement(props.as || 'div', props, props.children)
});

export const AnimatePresence = Dummy;
export const LayoutGroup = Dummy;

export default motion;
