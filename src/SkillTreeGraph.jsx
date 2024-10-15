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
  const [cameraState, setCameraState] = useState({
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    zoom: 1,
  });

  // Sphere radius
  const radius = 100;
  const radius2 = 105;

  // Refs for variables used in event handlers
  const isDraggingRef = useRef(false);
  const intersectedNodeRef = useRef(null);
  const initialPointerPosRef = useRef({ x: 0, y: 0 });
  const mouseRef = useRef(new THREE.Vector2());
  const raycasterRef = useRef(new THREE.Raycaster());

  // Load the icon texture
  const textureLoader = new THREE.TextureLoader();
  const iconTexture = textureLoader.load(eyeIcon);

  // Store initial camera position
  const initialCameraPositionRef = useRef(null);

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
      opacity: 0.05,
      depthWrite: false, // Prevent sphere from occluding nodes
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.renderOrder = -1; // Render sphere first
    fgRef.current.scene().add(sphere);

    // Add ambient light to the scene
    const light = new THREE.AmbientLight(0xffffff, 1);
    fgRef.current.scene().add(light);

    // Adjust camera position to view the entire sphere
    const initialPosition = { x: 0, y: 0, z: radius * 3 };
    fgRef.current.cameraPosition(initialPosition);

    // Store initial camera position
    if (!initialCameraPositionRef.current) {
      initialCameraPositionRef.current = { ...initialPosition };
    }

    // Add controls change listener to update camera state
    const controls = fgRef.current.controls();

    const handleControlChange = () => {
      const camera = fgRef.current.camera();
      setCameraState({
        position: {
          x: camera.position.x.toFixed(2),
          y: camera.position.y.toFixed(2),
          z: camera.position.z.toFixed(2),
        },
        rotation: {
          x: camera.rotation.x.toFixed(2),
          y: camera.rotation.y.toFixed(2),
          z: camera.rotation.z.toFixed(2),
        },
        zoom: camera.zoom.toFixed(2),
      });
      handleRenderFrame();
    };

    controls.addEventListener('change', handleControlChange);

    // Clean up the event listener when the component unmounts
    return () => {
      controls.removeEventListener('change', handleControlChange);
    };
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
    tube.renderOrder = 0; // Render links after sphere, before nodes
    return tube;
  };

  // Node appearance
  const nodeThreeObject = (node) => {
    // Create a group to hold the plane and the outline
    const group = new THREE.Group();

    // Create a plane geometry for the icon
    const iconSize = 10;
    const geometry = new THREE.PlaneGeometry(iconSize, iconSize);
    const material = new THREE.MeshBasicMaterial({
      map: iconTexture,
      transparent: true,
      side: THREE.DoubleSide, // Ensure both sides are rendered
    });

    const plane = new THREE.Mesh(geometry, material);
    plane.__data = node; // Store reference to node data

    group.add(plane);
    node.__threeObj = group; // Store the group as the node's object

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

      group.add(outline);
      node.__outline = outline; // Store outline for later access
    }

    group.renderOrder = 1; // Render nodes after sphere and links

    return group;
  };

  // Update node objects when selectedNodes changes
  useEffect(() => {
    // Update selection outlines
    graphData.nodes.forEach((node) => {
      if (node.__threeObj) {
        const group = node.__threeObj;
        // Remove existing outline if any
        if (node.__outline) {
          group.remove(node.__outline);
          node.__outline = null;
        }

        // If the node is selected, add an outline
        if (selectedNodes.has(node)) {
          const iconSize = 10; // Should be the same as in nodeThreeObject
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

          node.__threeObj.add(outline);
          node.__outline = outline;
        }
      }
    });

    fgRef.current.refresh();
  }, [selectedNodes, graphData.nodes]);

  // Custom node dragging and click logic using pointer events
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

      // Store initial pointer position
      initialPointerPosRef.current = { x: event.clientX, y: event.clientY };
      isDraggingRef.current = false;

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
        intersectedNodeRef.current = intersectedNode;

        // Disable controls to prevent scene rotation
        controls.enabled = false;

        // Prevent default behavior
        event.preventDefault();
        event.stopPropagation();
      } else {
        // No node clicked
        intersectedNodeRef.current = null;
        controls.enabled = true; // Enable controls for scene rotation
      }
    };

    const handlePointerMove = (event) => {
      const intersectedNode = intersectedNodeRef.current;

      if (intersectedNode) {
        const deltaX = event.clientX - initialPointerPosRef.current.x;
        const deltaY = event.clientY - initialPointerPosRef.current.y;
        const movement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (!isDraggingRef.current && movement > 5) {
          isDraggingRef.current = true;
          setDraggedNode(intersectedNode);
          // console.log('Node drag start: ', intersectedNode.id);
        }

        if (isDraggingRef.current) {
          // Get mouse position
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

            fgRef.current.refresh();
          }

          // Prevent default behavior
          event.preventDefault();
          event.stopPropagation();
        }
      }
    };

    const handlePointerUp = (event) => {
      const intersectedNode = intersectedNodeRef.current;

      if (isDraggingRef.current) {
        // Dragging was happening
        isDraggingRef.current = false;
        setDraggedNode(null);

        // Log node drag end
        // console.log('Node drag end:', intersectedNode.id);
      } else if (intersectedNode) {
        // No dragging occurred; handle click on node
        const node = intersectedNode;
        // Handle node selection logic here
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
          // console.log('Node clicked:', node.id);
        }
      } else {
        // Clicked on background, deselect all nodes
        setSelectedNodes(new Set());
      }

      // Reset intersectedNodeRef.current
      intersectedNodeRef.current = null;

      // Re-enable controls if not dragging
      controls.enabled = true;

      // Prevent default behavior
      event.preventDefault();
      event.stopPropagation();
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

  // Handle rendering frame to update node orientations
  const handleRenderFrame = () => {
    if (!fgRef.current) return;

    // Update nodes to face away from the sphere's center
    graphData.nodes.forEach((node) => {
      if (node.__threeObj) {
        // Compute the vector from the sphere center to the node
        const nodePosition = new THREE.Vector3(node.x, node.y, node.z).normalize();

        // Create a quaternion that rotates the node's positive Z-axis to align with the nodePosition vector
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1), // The default orientation of the plane's normal (positive Z-axis)
          nodePosition
        );

        // Apply the rotation to the node
        node.__threeObj.setRotationFromQuaternion(quaternion);
      }
    });
  };

  // Function to reset camera position
  const resetCameraPosition = () => {
    if (fgRef.current && initialCameraPositionRef.current) {
      fgRef.current.cameraPosition(
        initialCameraPositionRef.current,
        null,
        3000 // ms transition duration
      );
    }
  };

  return (
    <div className="w-100 h-100 overflow-none">
      {/* Render the 3D force graph */}
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        enableNodeDrag={false} // Disable built-in node dragging
        nodeAutoColorBy={null}
        linkDirectionalParticles={0}
        nodeBillboard={false}
        linkCurvature={0}
        enablePointerInteraction={true}
        // Removed onNodeClick and onBackgroundClick handlers
        linkColor={() => 'rgba(255,255,255,0.5)'}
        nodeThreeObject={nodeThreeObject}
        linkThreeObject={linkThreeObject} // Add custom link object
        linkPositionUpdate={() => {}} // Prevent force-graph from updating link positions
        onRenderFramePost={handleRenderFrame}
      />

      {/* UI Elements to display state */}
      <div className="absolute top-2 right-2 bg-white-10 pa2 br3">
        <h3 className="ma0">State Information</h3>
        <p className="ma0">
          <strong>Dragged Node:</strong>{' '}
          {draggedNode ? `Node ${draggedNode.id}` : 'None'}
        </p>
        <p className="ma0">
          <strong>Selected Nodes:</strong>{' '}
          {[...selectedNodes].map((node) => `Node ${node.id}`).join(', ') ||
            'None'}
        </p>
        <button onClick={resetCameraPosition}>Reset Camera</button>
        <h3 className="ma0">Camera State</h3>
        <p className="ma0">
          <strong>Position:</strong> X: {cameraState.position.x}, Y:{' '}
          {cameraState.position.y}, Z: {cameraState.position.z}
        </p>
        <p className="ma0">
          <strong>Rotation:</strong> X: {cameraState.rotation.x}, Y:{' '}
          {cameraState.rotation.y}, Z: {cameraState.rotation.z}
        </p>
        <p className="ma0">
          <strong>Zoom:</strong> {cameraState.zoom}
        </p>
      </div>
    </div>
  );
};

export default SkillTreeGraph;
