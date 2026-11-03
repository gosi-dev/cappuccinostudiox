/**
 * Resolve which project view a project should open.
 * Projects default to the original deck-driven project page; a project can opt
 * into the long-form case-study layout with `layout: 'story'`.
 */
export function projectPageFor(projectId, projectList) {
    let id = String(projectId ?? '');
    try {
        id = decodeURIComponent(id);
    } catch (_) {
        // Keep the original id when it is not valid percent-encoding.
    }
    const project = Array.isArray(projectList)
        ? projectList.find(item => item && String(item.id) === id)
        : null;
    return project && project.layout === 'story' ? 'project-story.html' : 'project.html';
}

export function projectUrlFor(projectId, projectList) {
    const id = String(projectId ?? '');
    return `${projectPageFor(id, projectList)}?id=${encodeURIComponent(id)}`;
}
