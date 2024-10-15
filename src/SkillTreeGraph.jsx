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

  // Node dragging handlers
  const handleNodeDragStart = (node) => {
    setDraggedNode(node);
    console.log("dragging: ", node.id);
  };

  const handleNodeDrag = (node) => {
    // Project the node back onto the sphere surface
    const r = Math.sqrt(node.x ** 2 + node.y ** 2 + node.z ** 2);
    const scale = radius / r;
    node.x *= scale;
    node.y *= scale;
    node.z *= scale;
  };

  const handleNodeDragEnd = (node) => {
    setDraggedNode(null);
    console.log("dragging end for node: ", node.id);
  };

  // Background click handler
  const handleBackgroundClick = () => {
    setSelectedNodes(new Set());
  };

  // Node appearance
  const nodeThreeObject = (node) => {
    const material = new THREE.MeshPhongMaterial({
      color: selectedNodes.has(node) ? 'yellow' : 'white',
    });
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(5, 16, 16),
      material
    );
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
  };

  return (
    <div>
      {/* Render the 3D force graph */}
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        enableNodeDrag={true} // Enable built-in node dragging
        nodeAutoColorBy={null}
        linkDirectionalParticles={0}
        linkCurvature={0}
        enablePointerInteraction={true}
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragEnd={handleNodeDragEnd}
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
