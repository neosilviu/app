import os

roots = ['frontend/app', 'registry-baseline.ts']
replacements = {
    'ENTITY_CONFIGS': 'ENTITY_CONFIG',
    'SYSTEM_ROLES': 'SYSTEM_ROLE',
    'EMAIL_TEMPLATES': 'EMAIL_TEMPLATE',
    'AI_PROMPTS': 'AI_PROMPT',
    'NAV_STRUCTURE': 'NAV',
    'CORE_CONSTANTS': 'CONSTANT',
    'SHORTCUTS': 'SHORTCUT',
    'INTEGRATIONS': 'INTEGRATION',
    'DASHBOARD_CONFIG': 'DASHBOARD',
    'THEME_CONFIG': 'THEME',
    'MARKETPLACE_TEMPLATES': 'MARKETPLACE_TEMPLATE',
    'system_setting': 'SYSTEM_SETTING',
    'COMMON_STATUSES': 'COMMON_STATUS',
    'COMMON_PRIORITIES': 'COMMON_PRIORITY',
    'COMMON_COLORS': 'COMMON_COLOR',
    'STATUSES': 'STATUS',
    '.permissions': '.permission',
    'permissions:': 'permission:',
    'permissions[': 'permission[',
    'permissions &&': 'permission &&',
    'permissions ||': 'permission ||',
    'permissions.': 'permission.',
    '.allowedPages': '.allowedPage',
    'allowedPages:': 'allowedPage:',
    'allowedPages.': 'allowedPage.',
    'roles: SYSTEM_ROLE': 'role: SYSTEM_ROLE',
    'actions/undo': 'action/undo',
    'actions: async': 'action: async',
    'users: async': 'member: async',
    'workspace_prompts': 'workspace_prompt',
    'parts[1] === "prompts"': 'parts[1] === "prompt"',
    'parts[1] === "actions"': 'parts[1] === "action"',
    'settings:users.': 'settings:user.',
    'common:roles.': 'common:role.',
    'users: {': 'user: {',
    'roles: {': 'role: {',
    'entities: []': 'entity: []',
    'entities: [': 'entity: [',
    '\"entities\"': '\"entity\"',
    "\'entities\'": "\'entity\'",
    'entities/save': 'entity/save',
    'entities/delete': 'entity/delete',
    'api/entities': 'api/entity',
    'sidebar_entities': 'sidebar_entity',
    'manage_entities': 'manage_entity',
    'coreEntities': 'coreEntity',
    'components/entities/': 'components/entity/',
    './entities/': './entity/',
    'entities: STATIC_CONSTANTS': 'entity: STATIC_CONSTANTS',
    'entities: nav.entities': 'entity: nav.entity',
    'navigation.entities': 'navigation.entity',
    'useConfig().entities': 'useConfig().entity',
    'const { entities': 'const { entity',
    'entities } = useConfig': 'entity } = useConfig',
    'entities: Record<string, any>': 'entity: Record<string, any>',
    'entities: NavItem[]': 'entity: NavItem[]',
    'navigation: {': 'navigation: {',
    'entities: (nav.entity': 'entity: (nav.entity',
    'setEntities(': 'setEntity(',
    'getInitialConfig().entities': 'getInitialConfig().entity',
    'useState<Record<string, any>>(() => getInitialConfig().entity)': 'useState<Record<string, any>>(() => getInitialConfig().entity)',
    'const [entities, setEntities]': 'const [entity, setEntity]',
    "t('entities:": "t('entity:",
    't("entities:': 't("entity:',
    'i18nKey="entities:': 'i18nKey="entity:',
    'navigation.workers': 'navigation.worker',
    'baseWorkers': 'baseWorker',
    'workers: []': 'worker: []',
    'workers:': 'worker:',
    'workers,': 'worker,',
    '.workers': '.worker',
}

for root_path in roots:
    if os.path.isfile(root_path):
        files = [root_path]
    else:
        files = []
        for r, d, f in os.walk(root_path):
            for file in f:
                if file.endswith(('.ts', '.tsx')):
                    files.append(os.path.join(r, file))

    for file_path in files:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        for old, new in replacements.items():
            content = content.replace(old, new)
        
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {file_path}")
