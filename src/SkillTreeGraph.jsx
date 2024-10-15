// src/SkillTreeGraph.js

import { useRef, useEffect, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import eyeIcon from './assets/eye.png'; // Import the icon

const SkillTreeGraph = () => {
  const fgRef = useRef();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [draggedNode, setDraggedNode] = useState(null);
  const [selectedNodes, setSelectedNodes] = useState(new Set());

  // Sphere radius
  const radius = 100;
  const radius2 = 105;

  // Refs for variables used in event handlers
  const isDraggingRef = useRef(false);
  const intersectedNodeRef = useRef(null);
  const mouseRef = useRef(new THREE.Vector2());
  const raycasterRef = useRef(new THREE.Raycaster());

  // Load the icon texture
  const textureLoader = new THREE.TextureLoader();
  const iconTexture = textureLoader.load(eyeIcon);

  useEffect(() => {
    // Number of nodes
    const N = 10; // Increased number for demonstration

    // Generate nodes positioned on the sphere's surface
    const nodes = [...Array(N).keys()].map((i) => {
      // Calculate spherical coordinates for even distribution
      const phi = Math.acos(-1 + (2 * i) / N); // latitude angle
      const theta = Math.sqrt(N * Math.PI) * phi; // longitude angle

      // Convert spherical coordinates to Cartesian coordinates
      const x = radius2 * Math.cos(theta) * Math.sin(phi);
      const y = radius2 * Math.sin(theta) * Math.sin(phi);
      const z = radius2 * Math.cos(phi);

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

  // Function to calculate great circle points
  const getGreatCirclePoints = (start, end, numPoints = 100) => {
    const startVec = new THREE.Vector3(start.x, start.y, start.z).normalize();
    const endVec = new THREE.Vector3(end.x, end.y, end.z).normalize();

    const angle = startVec.angleTo(endVec);
    const axis = new THREE.Vector3().crossVectors(startVec, endVec).normalize();

    const points = [];
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const quat = new THREE.Quaternion().setFromAxisAngle(axis, angle * t);
      const point = startVec.clone().applyQuaternion(quat).multiplyScalar(radius2);
      points.push(point);
    }
    return points;
  };

  // Custom link object
  const linkThreeObject = (link) => {
    const start = link.source;
    const end = link.target;

    const points = getGreatCirclePoints(start, end);
    const curve = new THREE.CatmullRomCurve3(points);

    const geometry = new THREE.TubeGeometry(curve, 64, 0.5, 8, false);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const tube = new THREE.Mesh(geometry, material);
    return tube;
  };

  // Node appearance
  const nodeThreeObject = (node) => {
    // Create a plane geometry for the icon
    const iconSize = 10;
    const geometry = new THREE.PlaneGeometry(iconSize, iconSize);
    const material = new THREE.MeshBasicMaterial({
      map: iconTexture,
      transparent: true,
    });

    const plane = new THREE.Mesh(geometry, material);
    plane.__data = node; // Store reference to node data
    node.__threeObj = plane;

    // If the node is selected, add an outline
    if (selectedNodes.has(node)) {
      const outlineGeometry = new THREE.RingGeometry(
        iconSize / 2 + 1,
        iconSize / 2 + 3,
        32
      );
      const outlineMaterial = new THREE.MeshBasicMaterial({
        color: 'yellow',
        side: THREE.DoubleSide,
      });
      const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
      outline.rotation.x = Math.PI / 2; // Adjust rotation to face camera

      plane.add(outline);
    }

    return plane;
  };

  // Update node objects when selectedNodes changes
  useEffect(() => {
    // Refresh all nodes to update the selection outline
    fgRef.current.refresh();
  }, [selectedNodes]);

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
      console.log("normal node click detected on node: ", node.id)
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
      new THREE.SphereGeometry(radius2, 32, 32),
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
        console.log('Node drag start: ', intersectedNode.id);

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
        // console.log('Node dragging:', intersectedNode);

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
        // console.log('Node drag end:', intersectedNode);

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
        linkThreeObject={linkThreeObject} // Add custom link object
        linkPositionUpdate={() => {}} // Prevent force-graph from updating link positions
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
