/* Extracted from project.html so the page can run under a strict CSP (script-src 'self'). */
        /* Direct links to a story project should never render the old deck page. */
        (function () {
            var params = new URLSearchParams(window.location.search);
            var projectId = params.get('id');
            if (!projectId) return;
            var root = document.documentElement;
            var timeout;
            root.classList.add('story-route-check');
            var clear = function () {
                clearTimeout(timeout);
                root.classList.remove('story-route-check');
            };
            timeout = setTimeout(clear, 1200);
            fetch('src/data/projects.json', { cache: 'no-store' })
                .then(function (response) { return response.ok ? response.json() : []; })
                .then(function (projects) {
                    var project = Array.isArray(projects)
                        ? projects.find(function (item) { return String(item.id) === projectId; })
                        : null;
                    if (project && project.layout === 'story') {
                        window.location.replace('project-story.html' + window.location.search);
                        return;
                    }
                    if (!project && Array.isArray(projects) && projects.length) {
                        /* The id is stale (the project was unpublished). The deck
                           below is only a placeholder, so send people to the files. */
                        window.location.replace('project-files.html');
                        return;
                    }
                    clear();
                })
                .catch(clear);
        })();
    