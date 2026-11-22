// Draws the CV sections marked `graph: true` in _data/cv.yml as a force-directed network.
// time_table sections -> organization + role nodes (role `skills:` link to skill nodes);
// map sections -> skill-area nodes whose comma-separated `value` becomes skill nodes.
(function () {
  var el = document.getElementById("cv-graph");
  var panel = document.getElementById("cv-graph-panel");
  if (!el || !window.d3) return;
  var sections = JSON.parse(document.getElementById("cv-graph-data").textContent);

  // ---- build nodes and links ----
  var nodes = [], links = [], byId = new Map(), linkKeys = new Set(), adj = new Map();
  function add(id, props) {
    if (!byId.has(id)) {
      var n = Object.assign({ id: id, roles: [], skills: [] }, props);
      byId.set(id, n); nodes.push(n); adj.set(id, new Set());
    }
    return byId.get(id);
  }
  function link(a, b, kind) {
    var k = a.id + "|" + b.id;
    if (linkKeys.has(k)) return;
    linkKeys.add(k);
    links.push({ source: a.id, target: b.id, kind: kind });
    adj.get(a.id).add(b.id); adj.get(b.id).add(a.id);
  }
  function skill(name) {
    return add("skill:" + name.trim().toLowerCase(), { type: "skill", label: name.trim() });
  }

  var me = add("me", { type: "me", label: el.dataset.name });
  var firstRole = null;
  sections.forEach(function (sec) {
    (sec.contents || []).forEach(function (c) {
      if (sec.type === "map") {
        var cat = add("cat:" + c.name, { type: "category", label: c.name });
        link(me, cat, "tree");
        String(c.value).split(",").forEach(function (s) {
          var sk = skill(s);
          sk.category = c.name;
          cat.skills.push(sk);
          link(cat, sk, "tree");
        });
      } else {
        var orgName = (c.institution || sec.title).split(",")[0];
        var org = add("org:" + orgName, { type: "org", label: orgName, place: c.institution });
        link(me, org, "tree");
        var role = add("role:" + orgName + ":" + c.title, {
          type: "role", label: c.title, org: c.institution, year: c.year,
          bullets: c.description || [], section: sec.title
        });
        org.roles.push(role);
        link(org, role, "tree");
        (c.skills || []).forEach(function (s) {
          var sk = skill(s);
          role.skills.push(sk); sk.roles.push(role);
          link(role, sk, "uses");
        });
        if (!firstRole) firstRole = role;
      }
    });
  });

  // ---- layout ----
  var width = el.clientWidth, height = el.clientHeight;
  function radius(n) {
    return { me: 26, org: 12, role: 9, category: 9 }[n.type] || 3.5 + 2.5 * n.roles.length;
  }
  // Work on the left, skill areas on the right; skills used at work settle between them.
  function homeX(n) {
    var x = { me: 0, org: -0.4, role: -0.22, category: 0.3 }[n.type];
    if (x === undefined) x = n.roles.length ? 0.04 : 0.34;
    return x * width;
  }
  // Work side reads as a timeline: organizations top to bottom in cv.yml order (newest first),
  // each organization's roles stacked beside it.
  var orgs = nodes.filter(function (n) { return n.type === "org"; });
  var step = Math.min(100, (height - 60) / orgs.length);
  // These nodes are pinned (fx/fy), so only the skill side is simulated.
  orgs.forEach(function (o, i) {
    o.homeY = (i - (orgs.length - 1) / 2) * step;
    o.roles.forEach(function (r, k) { r.homeY = o.homeY + (k - (o.roles.length - 1) / 2) * 30; });
  });
  nodes.forEach(function (n) {
    if (n.homeY !== undefined) { n.fx = n.type === "org" ? -0.36 * width : -0.24 * width; n.fy = n.homeY; }
  });
  me.fx = 0; me.fy = 0;
  function hasHomeY(n) { return n.homeY !== undefined; }
  var sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(function (d) { return d.id; })
      .distance(function (l) {
        return l.kind === "uses" ? 120 : l.source.type === "me" ? 110 : l.source.type === "org" ? 120 : 38;
      })
      .strength(function (l) { return l.kind === "uses" ? 0.12 : l.source.type === "org" ? 0.2 : 0.8; }))
    .force("charge", d3.forceManyBody().strength(function (n) { return n.type === "skill" ? (n.roles.length ? -50 : -30) : -220; }))
    // Labelled nodes get extra room so their text does not overlap.
    .force("collide", d3.forceCollide(function (n) {
      return radius(n) + (n.type === "org" || n.type === "role" ? 14 : n.roles.length || n.type !== "skill" ? 10 : 3);
    }))
    .force("x", d3.forceX(homeX).strength(function (n) { return hasHomeY(n) ? 0.6 : n.type === "skill" ? 0.08 : 0.3; }))
    .force("y", d3.forceY(function (n) { return hasHomeY(n) ? n.homeY : 0; })
      // Skills with no skill area (e.g. SSRS) have only weak links, so hold them near the middle.
      .strength(function (n) { return hasHomeY(n) ? 0.6 : n.type === "skill" && !n.category ? 0.25 : 0.04; }));

  var svg = d3.select(el).append("svg")
    .attr("viewBox", [-width / 2, -height / 2, width, height])
    .attr("role", "img")
    .attr("aria-label", "Network graph of roles, organizations and skills. Details appear below the graph.");
  var g = svg.append("g");
  var zoom = d3.zoom().scaleExtent([0.3, 4]).on("zoom", function (e) { g.attr("transform", e.transform); });
  svg.call(zoom).on("click", function () { clearFocus(); });

  var linkSel = g.append("g").selectAll("line").data(links).join("line")
    .attr("class", function (l) { return "link " + l.kind; });

  var nodeSel = g.append("g").selectAll("g").data(nodes).join("g")
    .attr("class", function (n) {
      return "node " + n.type + (n.type === "skill" && !n.roles.length ? " unused minor" : "");
    })
    .attr("tabindex", function (n) { return n.type === "skill" ? null : 0; })
    .on("mouseenter", function (e, n) { focus(n); })
    .on("mouseleave", function () { focus(selected); })
    .on("click", function (e, n) { e.stopPropagation(); select(n); })
    .on("keydown", function (e, n) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(n); } })
    .call(d3.drag()
      .on("start", function (e, n) { if (!e.active) sim.alphaTarget(0.3).restart(); n.fx = n.x; n.fy = n.y; })
      .on("drag", function (e, n) { n.fx = e.x; n.fy = e.y; })
      // Pinned nodes stay where they are dropped; free nodes rejoin the simulation.
      .on("end", function (e, n) { if (!e.active) sim.alphaTarget(0); if (n.homeY === undefined && n !== me) { n.fx = null; n.fy = null; } }));

  nodeSel.append("circle").attr("r", radius);
  // Profile photo inside the centre node.
  svg.append("defs").append("clipPath").attr("id", "cv-graph-clip")
    .append("circle").attr("r", radius(me) - 2);
  nodeSel.filter(function (n) { return n.type === "me"; }).append("image")
    .attr("href", el.dataset.photo)
    .attr("x", -radius(me) + 2).attr("y", -radius(me) + 2)
    .attr("width", 2 * radius(me) - 4).attr("height", 2 * radius(me) - 4)
    .attr("preserveAspectRatio", "xMidYMin slice")
    .attr("clip-path", "url(#cv-graph-clip)");
  // Timeline labels sit beside their node (organization left, role right); the rest sit below.
  nodeSel.append("text")
    .attr("dx", function (n) { return n.type === "org" ? -radius(n) - 6 : n.type === "role" ? radius(n) + 6 : 0; })
    .attr("dy", function (n) { return hasHomeY(n) ? 4 : radius(n) + 11; })
    .attr("text-anchor", function (n) { return n.type === "org" ? "end" : n.type === "role" ? "start" : "middle"; })
    .text(function (n) { return n.label; });

  function draw() {
    linkSel.attr("x1", function (l) { return l.source.x; }).attr("y1", function (l) { return l.source.y; })
      .attr("x2", function (l) { return l.target.x; }).attr("y2", function (l) { return l.target.y; });
    nodeSel.attr("transform", function (n) { return "translate(" + n.x + "," + n.y + ")"; });
  }
  // Zoom so the whole settled graph, labels included, fits the box.
  function fit() {
    var b = g.node().getBBox(), pad = 16;
    var k = Math.min(1.6, (width - 2 * pad) / b.width, (height - 2 * pad) / b.height);
    var t = d3.zoomIdentity.scale(k).translate(-(b.x + b.width / 2), -(b.y + b.height / 2));
    svg.call(zoom.transform, t);
  }
  // Settle the layout up front so the first paint is final and fitted on any device;
  // the simulation only animates again while a node is dragged.
  sim.stop();
  for (var i = 0; i < 300; i++) sim.tick();
  sim.on("tick", draw);
  draw();
  fit();

  // ---- highlight + details ----
  var selected = null;
  function focus(n) {
    el.classList.toggle("focus", !!n);
    if (!n) return;
    var near = adj.get(n.id);
    nodeSel.classed("near", function (d) { return d === n || near.has(d.id); });
    linkSel.classed("near", function (l) { return l.source === n || l.target === n; });
  }
  function clearFocus() {
    selected = null;
    nodeSel.classed("selected", false);
    focus(null);
  }
  function select(n) {
    selected = n;
    nodeSel.classed("selected", function (d) { return d === n; });
    focus(n);
    renderPanel(n);
  }

  function chips(parent, list) {
    if (!list.length) return;
    parent.append("div").attr("class", "chips").selectAll("button").data(list).join("button")
      .attr("type", "button")
      .text(function (d) { return d.label; })
      .on("click", function (e, d) { select(d); });
  }
  function renderPanel(n) {
    var p = d3.select(panel).html("");
    if (n.type === "role") {
      p.append("h4").text(n.label);
      p.append("div").attr("class", "meta").text([n.org, n.year].filter(Boolean).join(" · "));
      p.append("ul").selectAll("li").data(n.bullets).join("li").text(function (b) { return b; });
      if (n.skills.length) p.append("strong").text("Tools used");
      chips(p, n.skills);
    } else if (n.type === "org") {
      p.append("h4").text(n.label);
      p.append("div").attr("class", "meta").text(n.place || "");
      chips(p, n.roles);
    } else if (n.type === "category") {
      p.append("h4").text(n.label);
      p.append("div").attr("class", "meta").text(n.skills.length + " skills");
      chips(p, n.skills);
    } else if (n.type === "skill") {
      p.append("h4").text(n.label);
      p.append("div").attr("class", "meta").text(n.category || "Skill");
      p.append("p").text(n.roles.length ? "Used in:" : "Listed skill, not tied to a specific role.");
      chips(p, n.roles);
    } else {
      p.append("h4").text(n.label);
      p.append("div").attr("class", "meta").text(
        nodes.filter(function (d) { return d.type === "role"; }).length + " roles and projects · " +
        nodes.filter(function (d) { return d.type === "skill"; }).length + " skills");
      chips(p, nodes.filter(function (d) { return d.type === "org" || d.type === "category"; }));
    }
  }

  // Start with the current role's details shown, without dimming the graph.
  if (firstRole) renderPanel(firstRole);
})();
