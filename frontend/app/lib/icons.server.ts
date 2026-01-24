/**
 * ICONS SERVER - Lean & Mean
 * This file replaces icons.ts during SSR/Worker build to strip lucide-react.
 */

export const IconMap: Record<string, any> = {};

export const resolveIcon = (name: string): any => {
    // Return null or a simple string representation
    // The client will hydrate the actual icon
    return null;
};
