// src/SkillTreeGraph.js

import { useRef, useEffect, useState, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import eyeIcon from './assets/eye.png'; // Import the icon

// Load the icon texture
const textureLoader = new THREE.TextureLoader();
const iconTexture = textureLoader.load(eyeIcon);

// Reusable geometries and materials
const iconSize = 10;
const planeGeometry = new THREE.PlaneGeometry(iconSize, iconSize);
const planeMaterial = new THREE.MeshBasicMaterial({
  map: iconTexture,
  transparent: true,
  side: THREE.DoubleSide,
  depthWrite: false
});

const outlineGeometry = new THREE.RingGeometry(4.9, 5.1, 32);
const outlineMaterial = new THREE.MeshBasicMaterial({
  color: 'yellow',
  side: THREE.DoubleSide,
});

// Reusable link material
const linkMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });

const getLinkColor = () => 'rgba(255,255,255,0.5)';

const SkillTreeGraph = () => {
  const fgRef = useRef();
  const containerRef = useRef();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [draggedNode, setDraggedNode] = useState(null);
  const [selectedNodes, setSelectedNodes] = useState(new Set());
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // logging function that prints out dimensions
  const logDimensions = () => {
    console.log("container dimensions: ", dimensions);
  };

  // logging function that prints out all the nodes and edges
  const logGraphData = () => {
    console.log("nodes: ", graphData.nodes);
    console.log("edges: ", graphData.links);
  };

  const logManyThings = () => {
    logDimensions();
    logGraphData();
  }

  // Sphere radius
  const radius = 100;
  const radius2 = 105;

  // Refs for variables used in event handlers
  const isDraggingRef = useRef(false);
  const intersectedNodeRef = useRef(null);
  const initialPointerPosRef = useRef({ x: 0, y: 0 });
  const mouseRef = useRef(new THREE.Vector2());
  const raycasterRef = useRef(new THREE.Raycaster());

  // Store initial camera position
  const initialCameraPositionRef = useRef(null);

  const justAddedNode = useRef(false);

  // Modify the addNode function
  const addNode = () => {
    if (!fgRef.current) return;

    const camera = fgRef.current.camera();

    // Get the camera's viewing direction
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.normalize();

    // Calculate the point on the sphere's surface
    const x = -direction.x * radius2;
    const y = -direction.y * radius2;
    const z = -direction.z * radius2;

    // get next available ID
    let i = 0;
    while(graphData.nodes.find((node) => node.id === i)) {
      i++;
    }

    const newNode = {
      id: i,
      x,
      y,
      z,
    };
  
    justAddedNode.current = true;
    setGraphData((prevData) => ({
      nodes: [...prevData.nodes, newNode],
      links: [...prevData.links],
    }));
  };

  const deleteSelectedNodes = () => {
    if (selectedNodes.size === 0) return;
  
    justAddedNode.current = true;
    setGraphData((prevData) => {
      const nodesToDelete = new Set([...selectedNodes].map((node) => node.id));
      const newNodes = prevData.nodes.filter((node) => !nodesToDelete.has(node.id));
      const newLinks = prevData.links.filter(
        (link) => !nodesToDelete.has(link.source) && !nodesToDelete.has(link.target)
      );
      // console.log("old nodes: ", prevData.nodes);
      // console.log('Deleted nodes:', nodesToDelete);
      // console.log("resulting remaining nodes: ", newNodes);
      return { nodes: newNodes, links: newLinks };
    });
  
    // Clear selected nodes
    setSelectedNodes(new Set());
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Delete' || event.keyCode === 46) {
        deleteSelectedNodes();
      }
    };
  
    window.addEventListener('keydown', handleKeyDown);
  
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedNodes]);
  

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

    fgRef.current.controls().noPan = true; // pan is disabled here
  }, []);

  useEffect(() => {
    if(justAddedNode.current) {
      justAddedNode.current = false;
      return;
    }
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
  const linkThreeObject = useCallback(
    (link) => {
      // Retrieve the start and end node objects
      const startNode = graphData.nodes.find((n) => n.id === link.source);
      const endNode = graphData.nodes.find((n) => n.id === link.target);
  
      // Ensure both nodes exist
      if (!startNode || !endNode) return null;
  
      // Calculate the great circle points between the nodes
      const points = getGreatCirclePoints(startNode, endNode);
      const curve = new THREE.CatmullRomCurve3(points);
  
      // Create the tube geometry for the link
      const geometry = new THREE.TubeGeometry(curve, 32, 0.5, 8, false);
      const tube = new THREE.Mesh(geometry, linkMaterial);
      tube.renderOrder = 0; // Render links after sphere, before nodes
  
      // Store a reference to the mesh object in the link data
      link.__lineObj = tube;

      return tube;
    },
    [graphData.nodes] // Include graphData.nodes in dependencies
  );
  
  // Function to update connected links when a node moves
  const updateConnectedLinks = (node) => {
    // Find all links connected to this node
    const connectedLinks = graphData.links.filter(
      (link) => link.source === node.id || link.target === node.id
    );

    connectedLinks.forEach((link) => {
      const startNode = graphData.nodes.find((n) => n.id === link.source);
      const endNode = graphData.nodes.find((n) => n.id === link.target);

      if (!startNode || !endNode) return;

      // Recalculate the curve points
      const points = getGreatCirclePoints(startNode, endNode);
      const curve = new THREE.CatmullRomCurve3(points);

      // Create new geometry
      const newGeometry = new THREE.TubeGeometry(curve, 32, 0.5, 8, false);

      // Dispose of the old geometry
      if (link.__lineObj) {
        link.__lineObj.geometry.dispose();
        // Assign new geometry
        link.__lineObj.geometry = newGeometry;
      }
    });
  };

  // Node appearance
  const nodeThreeObject = (node) => {
    // Create a group to hold the plane and the outline
    const group = new THREE.Group();

    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.__data = node; // Store reference to node data

    group.add(plane);
    node.__threeObj = group; // Store the group as the node's object

    // If the node is selected, add an outline
  if (selectedNodes.has(node)) {
    const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
    group.add(outline);
    node.__outline = outline;
  }

    // Compute the initial orientation
    const nodePosition = new THREE.Vector3(node.x, node.y, node.z).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      nodePosition
    );
    group.setRotationFromQuaternion(quaternion);

    group.renderOrder = 1; // Render nodes after sphere and links

    return group;
  };

  const memoizedNodeThreeObject = useCallback(
    (node) => nodeThreeObject(node),
    [selectedNodes]
  );
  
  const memoizedLinkThreeObject = useCallback(
    (link) => linkThreeObject(link),
    [linkThreeObject]
  );

  // Update node objects when selectedNodes changes
  useEffect(() => {
    // Update selection outlines
    graphData.nodes.forEach((node) => {
      if (node.__threeObj) {
        const group = node.__threeObj;
  
        // Remove existing outline if any
        if (node.__outline) {
          group.remove(node.__outline);
          node.__outline.geometry.dispose();
          node.__outline.material.dispose();
          node.__outline = null;
        }
  
        // If the node is selected, add an outline
        if (selectedNodes.has(node)) {
          const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
          group.add(outline);
          node.__outline = outline;
        }
      }
    });
  }, [selectedNodes]);
  

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
      new THREE.SphereGeometry(radius2, 128, 128),
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
          
            // Mark the node's object for update
            intersectedNode.__threeObj.position.set(point.x, point.y, point.z);
            
            // Update connected links
            updateConnectedLinks(intersectedNode);
            
            handleRenderFrame();
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
  }, [graphData.nodes, graphData.links]);

  // Handle rendering frame to update node orientations
  const handleRenderFrame = () => {
    if (!fgRef.current) return;
  
    const sphereUp = new THREE.Vector3(0, 1, 0); // Sphere's up direction
  
    graphData.nodes.forEach((node) => {
      if (node.__threeObj) {
        // Node position vector normalized
        const nodePosition = new THREE.Vector3(node.x, node.y, node.z).normalize();
  
        // Compute the right vector (perpendicular to nodePosition and sphereUp)
        let right = new THREE.Vector3().crossVectors(sphereUp, nodePosition);
        if (right.lengthSq() === 0) {
          // nodePosition is parallel to sphereUp (north or south pole)
          right = new THREE.Vector3(1, 0, 0).cross(nodePosition).normalize();
        } else {
          right.normalize();
        }
  
        // Compute the adjusted up vector
        const up = new THREE.Vector3().crossVectors(nodePosition, right).normalize();
  
        // Construct rotation matrix
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeBasis(right, up, nodePosition);
  
        // Set the node's rotation from the rotation matrix
        node.__threeObj.setRotationFromMatrix(rotationMatrix);
      }
    });
  };  

  // Function to reset camera position
  const resetCameraPosition = () => {
    if (fgRef.current && initialCameraPositionRef.current) {
      const camera = fgRef.current.camera();
      const controls = fgRef.current.controls();
  
      const startTime = performance.now();
      const duration = 2000; // Duration in milliseconds
  
      const startPosition = camera.position.clone();
      const endPosition = new THREE.Vector3(
        initialCameraPositionRef.current.x,
        initialCameraPositionRef.current.y,
        initialCameraPositionRef.current.z
      );
  
      const startQuaternion = camera.quaternion.clone();
      const endQuaternion = new THREE.Quaternion(); // Identity quaternion (no rotation)
  
      const startTarget = controls.target.clone();
      const endTarget = new THREE.Vector3(0, 0, 0);
  
      // Easing function for smooth animation
      const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
  
      const animate = (currentTime) => {
        const elapsedTime = currentTime - startTime;
        const t = Math.min(elapsedTime / duration, 1); // Clamp t between 0 and 1
  
        const tEased = easeInOutQuad(t);
  
        // Interpolate position
        camera.position.lerpVectors(startPosition, endPosition, tEased);
  
        // Interpolate rotation using slerpQuaternions
        camera.quaternion.slerpQuaternions(startQuaternion, endQuaternion, tEased);
  
        // Interpolate controls target
        controls.target.lerpVectors(startTarget, endTarget, tEased);
  
        // Ensure the camera's up vector is correct
        camera.up.set(0, 1, 0);
  
        // Update camera and controls
        camera.updateProjectionMatrix();
        controls.update();
  
        // Continue animation if not finished
        if (t < 1) {
          requestAnimationFrame(animate);
        }
      };
  
      requestAnimationFrame(animate);
    }
  };
  
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        // console.log("initializing canvas dimensions...");
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
  
    window.addEventListener('resize', handleResize);
  
    // Call handleResize once to set the initial dimensions
    handleResize();
  
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  

  return (
    <div
      ref={containerRef}
      className="w-100 vh-100 overflow-none"
    >
      {/* Render the 3D force graph */}
      <ForceGraph3D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        enableNodeDrag={false} // Disable built-in node dragging
        nodeAutoColorBy={null}
        linkDirectionalParticles={0}
        linkCurvature={0}
        enablePointerInteraction={true}
        linkColor={() => 'rgba(255,255,255,0.5)'}
        nodeThreeObject={memoizedNodeThreeObject}
        linkThreeObject={memoizedLinkThreeObject} // Add custom link object
        linkPositionUpdate={getLinkColor} // Prevent force-graph from updating link positions
        showNavInfo={false}
      />

      {/* UI Elements to display state */}
      <div className="absolute top-2 right-2 bg-white-10 pa2 br3 w5">
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
      <div className="">
        <button className="dib" onClick={addNode}>Add Node</button>
        <button className="dib" onClick={resetCameraPosition}>Reset Camera</button>
        <button className="dib" onClick={logManyThings}>Log</button>
        </div>
      </div>
    </div>
  );
};

export default SkillTreeGraph;
