"use client";

import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ChecklistOutlinedIcon from "@mui/icons-material/ChecklistOutlined";
import AddIcon from "@mui/icons-material/Add";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import AttachmentOutlinedIcon from "@mui/icons-material/AttachmentOutlined";
import CheckIcon from "@mui/icons-material/Check";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import FunctionsOutlinedIcon from "@mui/icons-material/FunctionsOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import SettingsSuggestOutlinedIcon from "@mui/icons-material/SettingsSuggestOutlined";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useState } from "react";
import { logout } from "@/lib/actions/auth";
import { switchWorkspace } from "@/lib/actions/workspace";

const DRAWER_WIDTH = 268;

type ProjectSummary = { id: string; key: string; name: string };
type JiraSummary = { siteName: string | null; siteUrl: string } | null;
type UserSummary = { name: string; email: string; role: string };

type IconComponent = ComponentType<{ fontSize?: "small" | "inherit" }>;

type NavItem = {
  href: string;
  label: string;
  icon: IconComponent;
  exact?: boolean;
};

type Mode = {
  key: string;
  label: string;
  href: string;
  icon: IconComponent;
  nav: NavItem[];
};

const modes: Mode[] = [
  { key: "projects", label: "Projects", href: "/projects", icon: FolderOutlinedIcon, nav: [] },
  { key: "workspace", label: "Workspace", href: "/workspace", icon: AppsOutlinedIcon, nav: [] },
  {
    key: "dashboards",
    label: "Dashboards",
    href: "/",
    icon: InsightsOutlinedIcon,
    nav: [{ href: "/", label: "Overview", icon: DashboardOutlinedIcon, exact: true }],
  },
  {
    key: "queries",
    label: "Queries",
    href: "/queries",
    icon: FilterAltOutlinedIcon,
    nav: [{ href: "/queries", label: "Saved queries", icon: FilterAltOutlinedIcon, exact: true }],
  },
  {
    key: "apps",
    label: "Apps",
    href: "/apps",
    icon: AppsOutlinedIcon,
    nav: [{ href: "/apps", label: "Integrations", icon: AppsOutlinedIcon, exact: true }],
  },
];

const workspaceNav: NavItem[] = [
  { href: "/workspace/users", label: "Users", icon: PeopleOutlinedIcon },
  { href: "/workspace/groups", label: "Groups", icon: GroupsOutlinedIcon },
  { href: "/workspace/roles", label: "Roles", icon: AdminPanelSettingsOutlinedIcon },
  { href: "/workspace/fields", label: "Fields", icon: TuneOutlinedIcon },
  { href: "/workspace/environments", label: "Environments", icon: PublicOutlinedIcon },
  { href: "/workspace/configurations", label: "Configurations", icon: SettingsSuggestOutlinedIcon },
  { href: "/workspace/parameters", label: "Parameters", icon: FunctionsOutlinedIcon },
  { href: "/workspace/preconditions", label: "Preconditions", icon: ChecklistOutlinedIcon },
  { href: "/workspace/shared-steps", label: "Shared steps", icon: AccountTreeOutlinedIcon },
  { href: "/workspace/tags", label: "Tags", icon: LabelOutlinedIcon },
  { href: "/workspace/attachments", label: "Attachments", icon: AttachmentOutlinedIcon },
  { href: "/workspace/audit", label: "Audit log", icon: HistoryOutlinedIcon },
  { href: "/workspace/sso", label: "Single sign-on", icon: LockOutlinedIcon },
];

function navItemSx() {
  return {
    borderRadius: 1.5,
    "&.Mui-selected": {
      bgcolor: "primary.main",
      color: "primary.contrastText",
      "&:hover": { bgcolor: "primary.dark" },
      "& .MuiListItemIcon-root": { color: "primary.contrastText" },
    },
  } as const;
}

export default function AppShell({
  workspaceName,
  activeWorkspaceId,
  workspaces,
  permissions,
  projects,
  jira,
  jiraEnabled,
  user,
  children,
}: {
  workspaceName: string;
  activeWorkspaceId: string;
  workspaces: { id: string; name: string }[];
  permissions: string[];
  projects: ProjectSummary[];
  jira: JiraSummary;
  jiraEnabled: boolean;
  user: UserSummary;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountAnchor, setAccountAnchor] = useState<null | HTMLElement>(null);
  const [workspaceAnchor, setWorkspaceAnchor] = useState<null | HTMLElement>(null);

  const closeMobile = () => setMobileOpen(false);

  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const activeProjectId = projectMatch?.[1] ?? null;
  const activeProject =
    projects.find((project) => project.id === activeProjectId) ?? null;

  const isSelected = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const mode = (() => {
    if (pathname === "/" || pathname.startsWith("/dashboards")) return "dashboards";
    if (pathname.startsWith("/workspace")) return "workspace";
    if (pathname.startsWith("/queries")) return "queries";
    if (pathname.startsWith("/apps")) return "apps";
    if (pathname.startsWith("/api")) return "dashboards";
    return "projects";
  })();

  const projectNav: NavItem[] = activeProject
    ? [
        { href: `/projects/${activeProject.id}`, label: "Overview", icon: DashboardOutlinedIcon, exact: true },
        { href: `/projects/${activeProject.id}/cases`, label: "Test cases", icon: ListAltOutlinedIcon },
        { href: `/projects/${activeProject.id}/runs`, label: "Test runs", icon: PlayArrowOutlinedIcon },
        { href: `/projects/${activeProject.id}/plans`, label: "Test plans", icon: AssignmentOutlinedIcon },
        { href: `/projects/${activeProject.id}/sets`, label: "Test sets", icon: FolderOutlinedIcon },
        { href: `/projects/${activeProject.id}/reports`, label: "Reports", icon: InsightsOutlinedIcon },
        { href: `/projects/${activeProject.id}/traceability`, label: "Traceability", icon: AccountTreeOutlinedIcon },
      ]
    : [];

  const workspaceSection = workspaceNav.find((item) => isSelected(item.href, item.exact));
  const projectSection = projectNav.find((item) => isSelected(item.href, item.exact));

  const title = (() => {
    if (mode === "workspace") return workspaceSection?.label ?? "Workspace";
    if (mode === "queries") return "Queries";
    if (mode === "apps") return "Apps";
    if (mode === "dashboards") return "Dashboard";
    return activeProject ? (projectSection?.label ?? activeProject.name) : "Projects";
  })();

  const renderNavItem = (item: NavItem) => {
    const selected = isSelected(item.href, item.exact);
    return (
      <ListItem key={item.href} disablePadding sx={{ mb: 0.5 }}>
        <ListItemButton
          component={Link}
          href={item.href}
          selected={selected}
          onClick={closeMobile}
          sx={navItemSx()}
        >
          <ListItemIcon sx={{ minWidth: 38 }}>
            <item.icon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={item.label} slotProps={{ primary: { variant: "body2" } }} />
        </ListItemButton>
      </ListItem>
    );
  };

  const renderProjectRow = (project: ProjectSummary) => (
    <ListItem key={project.id} disablePadding sx={{ mb: 0.5 }}>
      <ListItemButton
        component={Link}
        href={`/projects/${project.id}`}
        onClick={closeMobile}
        sx={navItemSx()}
      >
        <ListItemIcon sx={{ minWidth: 38 }}>
          <FolderOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={project.name}
          secondary={project.key}
          slotProps={{
            primary: { noWrap: true, variant: "body2" },
            secondary: { noWrap: true, variant: "caption" },
          }}
        />
      </ListItemButton>
    </ListItem>
  );

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar sx={{ px: 1.5 }}>
        <Button
          fullWidth
          color="inherit"
          onClick={(event) => setWorkspaceAnchor(event.currentTarget)}
          endIcon={<ExpandMoreIcon fontSize="small" />}
          sx={{ justifyContent: "space-between", textTransform: "none", px: 1 }}
        >
          <Box sx={{ textAlign: "left", overflow: "hidden" }}>
            <Typography variant="overline" color="text.secondary" sx={{ display: "block", lineHeight: 1 }}>
              Workspace
            </Typography>
            <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600 }}>
              {workspaceName}
            </Typography>
          </Box>
        </Button>
      </Toolbar>
      <Menu
        anchorEl={workspaceAnchor}
        open={Boolean(workspaceAnchor)}
        onClose={() => setWorkspaceAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { minWidth: 240 } } }}
      >
        {workspaces.map((workspace) => (
          <Box key={workspace.id} component="form" action={switchWorkspace}>
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <MenuItem
              component="button"
              type="submit"
              selected={workspace.id === activeWorkspaceId}
              onClick={closeMobile}
              sx={{ width: "100%" }}
            >
              <ListItemIcon>
                {workspace.id === activeWorkspaceId ? (
                  <CheckIcon fontSize="small" />
                ) : (
                  <FolderOutlinedIcon fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText primary={workspace.name} />
            </MenuItem>
          </Box>
        ))}
        <Divider />
        <MenuItem
          component={Link}
          href="/workspace/new"
          onClick={() => {
            setWorkspaceAnchor(null);
            closeMobile();
          }}
        >
          <ListItemIcon>
            <AddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="New workspace" />
        </MenuItem>
      </Menu>
      <Divider />

      {mode === "projects" ? (
        activeProject ? (
          <>
            <Box sx={{ px: 2.5, pt: 1, pb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                {activeProject.name}
              </Typography>
              <Chip size="small" variant="outlined" label={activeProject.key} sx={{ mt: 0.5 }} />
            </Box>
            <List sx={{ px: 1 }}>{projectNav.map(renderNavItem)}</List>
            <Divider />
            <List sx={{ px: 1, py: 1 }}>
              <ListItem disablePadding>
                <ListItemButton
                  component={Link}
                  href={`/projects/${activeProject.id}/settings`}
                  selected={isSelected(`/projects/${activeProject.id}/settings`)}
                  onClick={closeMobile}
                  sx={navItemSx()}
                >
                  <ListItemIcon sx={{ minWidth: 38 }}>
                    <SettingsOutlinedIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Project settings" slotProps={{ primary: { variant: "body2" } }} />
                </ListItemButton>
              </ListItem>
            </List>
            <Box sx={{ flexGrow: 1 }} />
            <Divider />
            <List sx={{ px: 1, py: 1 }}>
              <ListItem disablePadding>
                <ListItemButton component={Link} href="/projects" onClick={closeMobile} sx={navItemSx()}>
                  <ListItemIcon sx={{ minWidth: 38 }}>
                    <ArrowBackIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="All projects" slotProps={{ primary: { variant: "body2" } }} />
                </ListItemButton>
              </ListItem>
            </List>
          </>
        ) : (
          <>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, pt: 2, pb: 0.5 }}>
              <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1 }}>
                Projects
              </Typography>
              <Tooltip title="New project">
                <IconButton component={Link} href="/projects#new-project" size="small" onClick={closeMobile}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <List sx={{ px: 1, pb: 1, flexGrow: 1, overflowY: "auto" }}>
              {projects.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, py: 1 }}>
                  No projects yet.
                </Typography>
              ) : (
                projects.map(renderProjectRow)
              )}
            </List>
          </>
        )
      ) : mode === "workspace" ? (
        permissions.includes("workspace.manage") ? (
          <List sx={{ px: 1, py: 1 }}>{workspaceNav.map(renderNavItem)}</List>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            Workspace management is restricted to administrators.
          </Typography>
        )
      ) : (
        <List sx={{ px: 1, py: 1 }}>
          {(modes.find((m) => m.key === mode)?.nav ?? []).map(renderNavItem)}
        </List>
      )}

      {jiraEnabled && mode !== "workspace" ? (
        <>
          <Divider />
          <Box sx={{ p: 2 }}>
            {jira ? (
              <Chip size="small" color="success" variant="outlined" label={jira.siteName ?? "Jira connected"} sx={{ maxWidth: "100%" }} />
            ) : (
              <Button component={Link} href="/api/jira/oauth/start" size="small" variant="outlined" fullWidth>
                Connect Jira
              </Button>
            )}
          </Box>
        </>
      ) : null}
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        color="default"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ display: { md: "none" } }}
            aria-label="Open navigation"
          >
            <MenuIcon />
          </IconButton>

          <Avatar variant="rounded" sx={{ bgcolor: "primary.main", width: 30, height: 30, fontWeight: 700, fontSize: 15, display: { xs: "none", sm: "grid" } }}>
            T
          </Avatar>

          <Box sx={{ display: "flex", gap: 0.5, overflowX: "auto", flexGrow: 1, py: 0.5 }}>
            {modes.map((item) => {
              const active = item.key === mode;
              return (
                <Button
                  key={item.key}
                  component={Link}
                  href={item.href}
                  size="small"
                  startIcon={<item.icon fontSize="small" />}
                  sx={{
                    flexShrink: 0,
                    color: active ? "primary.main" : "text.secondary",
                    bgcolor: active ? "action.selected" : "transparent",
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Box>

          <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600, display: { xs: "none", lg: "block" } }}>
            {title}
          </Typography>

          <Tooltip title="Account">
            <IconButton
              size="small"
              onClick={(event) => setAccountAnchor(event.currentTarget)}
              aria-label="Account menu"
            >
              <Avatar sx={{ width: 30, height: 30, fontSize: 14, bgcolor: "secondary.main" }}>
                {user.name.charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={accountAnchor}
            open={Boolean(accountAnchor)}
            onClose={() => setAccountAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {user.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user.email}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {user.role}
              </Typography>
            </Box>
            <Divider />
            <MenuItem component={Link} href="/account" onClick={() => setAccountAnchor(null)}>
              <ListItemIcon>
                <SettingsOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Account settings" />
            </MenuItem>
            <Box component="form" action={logout}>
              <MenuItem component="button" type="submit" sx={{ width: "100%" }}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Log out" />
              </MenuItem>
            </Box>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }} aria-label="Navigation">
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={closeMobile}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" } }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box", borderRight: 1, borderColor: "divider" },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Toolbar />
        <Box sx={{ flexGrow: 1, py: 3, px: { xs: 2, sm: 3 } }}>{children}</Box>
        <Box component="footer" sx={{ borderTop: 1, borderColor: "divider", py: 2, px: 3 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center" }}>
            TestHub — test management with first-class Jira Cloud integration
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
