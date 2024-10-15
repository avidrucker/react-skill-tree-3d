// src/SkillTreeGraph.js

import React, { useRef, useEffect, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';

const SkillTreeGraph = () => {
  const fgRef = useRef();
  const [activatedNodes, setActivatedNodes] = useState(new Set());
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [draggedNode, setDraggedNode] = useState(null);

  // Sphere radius
  const radius = 100;

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

  // Custom node dragging logic (same as before)

  // Node appearance (move nodeThreeObject to a prop)
  const nodeThreeObject = (node) => {
    const material = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(5, 16, 16),
      material
    );
    // Store reference to node data
    sphere.__data = node;
    return sphere;
  };

  // Handle node clicks for activation (same as before)
  const handleNodeClick = (node, event) => {
    // Prevent triggering node drag
    if (event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

    if (activatedNodes.has(node.id)) {
      // Deactivate node
      setActivatedNodes((prev) => {
        const newSet = new Set(prev);
        newSet.delete(node.id);
        return newSet;
      });
    } else {
      // Check if all source nodes are activated
      const incomingLinks = graphData.links.filter(
        (link) => link.target === node.id
      );
      const allSourcesActivated = incomingLinks.every((link) =>
        activatedNodes.has(link.source)
      );

      if (incomingLinks.length === 0 || allSourcesActivated) {
        // Activate node
        setActivatedNodes((prev) => new Set(prev).add(node.id));
      } else {
        // Display message indicating prerequisites are not met
        alert('Activate prerequisite skills first.');
      }
    }
  };

  // Set node color based on activation state (same as before)
  const getNodeColor = (node) => {
    if (activatedNodes.has(node.id)) return 'green';

    const incomingLinks = graphData.links.filter(
      (link) => link.target === node.id
    );
    const allSourcesActivated = incomingLinks.every((link) =>
      activatedNodes.has(link.source)
    );

    return allSourcesActivated ? 'yellow' : 'gray';
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
        nodeColor={getNodeColor}
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
          <strong>Activated Nodes:</strong>{' '}
          {[...activatedNodes]
            .map((id) => `Node ${id}`)
            .join(', ') || 'None'}
        </p>
        <p>
          <strong>Dragged Node:</strong>{' '}
          {draggedNode ? `Node ${draggedNode.id}` : 'None'}
        </p>
      </div>
    </div>
  );
};

export default SkillTreeGraph;
