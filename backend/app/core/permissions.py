from enum import StrEnum


class Role(StrEnum):
    ADMIN = "admin"
    ENGINEER = "engineer"
    PLANNER = "planner"
    MANAGEMENT = "management"
    OPERATOR = "operator"
    VIEWER = "viewer"


class Permission(StrEnum):
    VIEW_COMMAND_CENTER = "view:command_center"
    MANAGE_USERS = "manage:users"
    MANAGE_TASKS = "manage:tasks"
    RUN_ENGINEERING_TOOLS = "run:engineering_tools"
    VIEW_FACTORY = "view:factory"
    SEND_REMOTE_COMMANDS = "send:remote_commands"
    VIEW_AUDIT_LOGS = "view:audit_logs"


ROLE_PERMISSIONS: dict[Role, set[Permission]] = {
    Role.ADMIN: set(Permission),
    Role.ENGINEER: {
        Permission.VIEW_COMMAND_CENTER,
        Permission.MANAGE_TASKS,
        Permission.RUN_ENGINEERING_TOOLS,
        Permission.VIEW_FACTORY,
        Permission.SEND_REMOTE_COMMANDS,
    },
    Role.PLANNER: {
        Permission.VIEW_COMMAND_CENTER,
        Permission.MANAGE_TASKS,
        Permission.RUN_ENGINEERING_TOOLS,
        Permission.VIEW_FACTORY,
    },
    Role.MANAGEMENT: {
        Permission.VIEW_COMMAND_CENTER,
        Permission.VIEW_FACTORY,
        Permission.VIEW_AUDIT_LOGS,
    },
    Role.OPERATOR: {
        Permission.VIEW_COMMAND_CENTER,
        Permission.RUN_ENGINEERING_TOOLS,
        Permission.VIEW_FACTORY,
    },
    Role.VIEWER: {
        Permission.VIEW_COMMAND_CENTER,
        Permission.VIEW_FACTORY,
    },
}
