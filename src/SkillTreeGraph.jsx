// src/SkillTreeGraph.js

import { useRef, useEffect, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';

const SkillTreeGraph = () => {
  const fgRef = useRef();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [draggedNode, setDraggedNode] = useState(null);
  const [selectedNodes, setSelectedNodes] = useState(new Set());

  // Sphere radius
  const radius = 100;

  // Refs for variables used in event handlers
  const isDraggingRef = useRef(false);
  const intersectedNodeRef = useRef(null);
  const mouseRef = useRef(new THREE.Vector2());
  const raycasterRef = useRef(new THREE.Raycaster());

  useEffect(() => {
    // Number of nodes
    const N = 10; // Increased number for demonstration

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
    const links = nodes.map((node) => {
      return { source: node.id, target: (node.id + 1) % N };
    });

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

  // Node appearance
  const nodeThreeObject = (node) => {
    const material = new THREE.MeshPhongMaterial({
      color: selectedNodes.has(node) ? 'yellow' : 'white',
    });
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(5, 16, 16),
      material
    );
    sphere.__data = node; // Store reference to node data
    node.__threeObj = sphere;
    node.__material = material; // Store material for updates
    return sphere;
  };

  // Update node colors when selectedNodes changes
  useEffect(() => {
    graphData.nodes.forEach((node) => {
      if (node.__material) {
        node.__material.color.set(selectedNodes.has(node) ? 'yellow' : 'white');
      }
    });
    if (fgRef.current) {
      fgRef.current.refresh();
    }
  }, [selectedNodes, graphData.nodes]);

  // Handle node clicks for selection
  const handleNodeClick = (node, event) => {
    if (event.shiftKey) {
      // Shift-click: toggle selection of the node
      setSelectedNodes((prev) => {
        const newSelectedNodes = new Set(prev);
        if (newSelectedNodes.has(node)) {
          newSelectedNodes.delete(node);
        } else {
          newSelectedNodes.add(node);
        }
        return newSelectedNodes;
      });
    } else {
      // Normal click: select only this node
      setSelectedNodes(new Set([node]));
    }

    // Prevent event from propagating to the background and controls
    event.preventDefault();
    event.stopPropagation();
  };

  // Background click handler
  const handleBackgroundClick = () => {
    setSelectedNodes(new Set());
  };

  // Custom node dragging logic using pointer events
  useEffect(() => {
    if (!fgRef.current) return;

    const fg = fgRef.current;
    const renderer = fg.renderer();
    const camera = fg.camera();
    const controls = fg.controls();
    const raycaster = raycasterRef.current;
    const mouse = mouseRef.current;

    // Create an invisible sphere for raycasting
    const sphereForRaycasting = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 32),
      new THREE.MeshBasicMaterial({ visible: false })
    );

    const handlePointerDown = (event) => {
      // Get mouse position
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Raycast
      raycaster.setFromCamera(mouse, camera);

      // Get nodes
      const nodeObjects = graphData.nodes
        .map((node) => node.__threeObj)
        .filter(Boolean);

      const intersects = raycaster.intersectObjects(nodeObjects, true);

      if (intersects.length > 0) {
        // Node clicked
        const intersectedNode = intersects[0].object.__data;

        isDraggingRef.current = true;
        controls.enabled = false; // Disable controls to prevent scene rotation
        intersectedNodeRef.current = intersectedNode;
        setDraggedNode(intersectedNode);

        // Log node drag start
        console.log('Node drag start:', intersectedNode);

        // Prevent default behavior
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handlePointerMove = (event) => {
      if (!isDraggingRef.current) return;

      const intersectedNode = intersectedNodeRef.current;
      if (!intersectedNode) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      // Intersect with sphere surface
      const intersects = raycaster.intersectObject(sphereForRaycasting);

      if (intersects.length > 0) {
        const point = intersects[0].point;

        // Update node position
        intersectedNode.x = point.x;
        intersectedNode.y = point.y;
        intersectedNode.z = point.z;

        // Log node dragging
        console.log('Node dragging:', intersectedNode);

        fgRef.current.refresh();
      }

      // Prevent default behavior
      event.preventDefault();
      event.stopPropagation();
    };

    const handlePointerUp = (event) => {
      if (isDraggingRef.current) {
        const intersectedNode = intersectedNodeRef.current;

        isDraggingRef.current = false;
        controls.enabled = true; // Re-enable controls
        intersectedNodeRef.current = null;
        setDraggedNode(null);

        // Log node drag end
        console.log('Node drag end:', intersectedNode);

        // Prevent default behavior
        event.preventDefault();
        event.stopPropagation();
      }
    };

    // Add event listeners
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    // Clean up
    return () => {
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
    };
  }, [graphData.nodes]);

  return (
    <div>
      {/* Render the 3D force graph */}
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        enableNodeDrag={false} // Disable built-in node dragging
        nodeAutoColorBy={null}
        linkDirectionalParticles={0}
        linkCurvature={0}
        enablePointerInteraction={true}
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        linkColor={() => 'rgba(255,255,255,0.5)'}
        nodeThreeObject={nodeThreeObject}
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
          maxWidth: '250px',
        }}
      >
        <h3>State Information</h3>
        <p>
          <strong>Dragged Node:</strong>{' '}
          {draggedNode ? `Node ${draggedNode.id}` : 'None'}
        </p>
        <p>
          <strong>Selected Nodes:</strong>{' '}
          {[...selectedNodes].map((node) => `Node ${node.id}`).join(', ') ||
            'None'}
        </p>
      </div>
    </div>
  );
};

export default SkillTreeGraph;
