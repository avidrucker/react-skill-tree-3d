// src/SkillTreeGraph.js

import { useRef, useEffect, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';

const SkillTreeGraph = () => {
  const fgRef = useRef();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [draggedNode, setDraggedNode] = useState(null);

  // Sphere radius
  const radius = 100;

  // Refs for variables used in event handlers
  const isDraggingRef = useRef(false);
  const intersectedNodeRef = useRef(null);
  const mouseRef = useRef(new THREE.Vector2());
  const raycasterRef = useRef(new THREE.Raycaster());

  useEffect(() => {
    // Number of nodes
    const N = 3;

    // Generate nodes positioned on the sphere's surface
    const nodes = [...Array(N).keys()].map((i) => {
      // Calculate spherical coordinates for even distribution
      const phi = Math.acos(-1 + (2 * i) / N); // latitude angle
      const theta = Math.sqrt(N * Math.PI) * phi; // longitude angle

      // Convert spherical coordinates to Cartesian coordinates
      const x = radius * Math.cos(theta) * Math.sin(phi);
      const y = radius * Math.sin(theta) * Math.sin(phi);
      const z = radius * Math.cos(phi);

      return {
        id: i,
        x,
        y,
        z,
      };
    });

    // Define links between nodes
    const links = [
      { source: 0, target: 1 },
      { source: 1, target: 2 },
    ];

    setGraphData({ nodes, links });
  }, []);

  useEffect(() => {
    if (!fgRef.current) return;

    // Disable internal forces by setting them to null
    fgRef.current.d3Force('center', null);
    fgRef.current.d3Force('charge', null);
    fgRef.current.d3Force('link', null);
    fgRef.current.d3Force('collision', null);

    // Add semitransparent sphere to the scene
    const sphereGeometry = new THREE.SphereGeometry(radius, 32, 32);
    const sphereMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.2,
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

    fgRef.current.scene().add(sphere);

    // Add ambient light to the scene
    const light = new THREE.AmbientLight(0xffffff, 1);
    fgRef.current.scene().add(light);

    // Adjust camera position to view the entire sphere
    fgRef.current.cameraPosition({ x: 0, y: 0, z: radius * 3 });
  }, [graphData]);

  // Event handler functions
  const onMouseMove = (event) => {
    if (!isDraggingRef.current) return;

    const fg = fgRef.current;
    if (!fg) return;

    const camera = fg.camera();
    const renderer = fg.renderer();
    const mouse = mouseRef.current;
    const raycaster = raycasterRef.current;
    const intersectedNode = intersectedNodeRef.current;

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Calculate the intersection point with the sphere
    const sphereIntersections = raycaster.intersectObject(
      new THREE.Mesh(
        new THREE.SphereGeometry(radius, 32, 32),
        new THREE.MeshBasicMaterial({ visible: false })
      )
    );

    if (sphereIntersections.length > 0) {
      const point = sphereIntersections[0].point;
      // Update node position
      intersectedNode.x = point.x;
      intersectedNode.y = point.y;
      intersectedNode.z = point.z;

      // Update the graph
      fg.refresh();
    }
  };

  const onMouseDown = (event) => {
    const fg = fgRef.current;
    if (!fg) return;

    const camera = fg.camera();
    const renderer = fg.renderer();
    const controls = fg.controls();
    const mouse = mouseRef.current;
    const raycaster = raycasterRef.current;

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Get the node objects
    if (!fg.graphData || !fg.graphData.nodes) return;

    const nodeObjects = fg.graphData.nodes
      .map((node) => node.__threeObj)
      .filter(Boolean);

    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(nodeObjects, true);

    if (intersects.length > 0) {
      // Start dragging
      isDraggingRef.current = true;
      controls.enabled = false; // Disable orbit controls during dragging
      intersectedNodeRef.current = intersects[0].object.userData.node;
      setDraggedNode(intersectedNodeRef.current);

      // Prevent default behavior
      event.preventDefault();
    }
  };

  const onMouseUp = () => {
    if (isDraggingRef.current) {
      const fg = fgRef.current;
      if (!fg) return;

      const controls = fg.controls();

      isDraggingRef.current = false;
      controls.enabled = true; // Re-enable orbit controls
      intersectedNodeRef.current = null;
      setDraggedNode(null);
    }
  };

  // Add event listeners
  useEffect(() => {
    if (!fgRef.current) return;

    const renderer = fgRef.current.renderer();

    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mouseup', onMouseUp);

    // Clean up on unmount
    return () => {
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Node appearance
  const nodeThreeObject = (node) => {
    const material = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(5, 16, 16),
      material
    );
    // Store reference to node data
    sphere.userData.node = node;
    node.__threeObj = sphere; // Store reference back in node data
    return sphere;
  };

  // Handle node clicks for selection
  const handleNodeClick = (node, event) => {
    // Selection logic can be implemented here
    console.log('Node clicked:', node);
  };

  return (
    <div>
      {/* Render the 3D force graph */}
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        enableNodeDrag={false} // Disable default node dragging
        nodeAutoColorBy={null}
        linkDirectionalParticles={0}
        linkCurvature={0}
        enablePointerInteraction={true}
        onNodeClick={handleNodeClick}
        nodeColor={() => 'white'}
        linkColor={() => 'rgba(255,255,255,0.5)'}
        nodeThreeObject={nodeThreeObject} // Pass nodeThreeObject as a prop
      />

      {/* UI Elements to display state */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          backgroundColor: 'rgba(255,255,255,0.8)',
          padding: '10px',
          borderRadius: '5px',
          maxWidth: '200px',
        }}
      >
        <h3>State Information</h3>
        <p>
          <strong>Dragged Node:</strong>{' '}
          {draggedNode ? `Node ${draggedNode.id}` : 'None'}
        </p>
      </div>
    </div>
  );
};

export default SkillTreeGraph;
