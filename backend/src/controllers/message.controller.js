import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import redis, { getJSON, setJSON, del } from "../lib/redis.js";

/**
 * Get all contacts except logged-in user
 */
export const getAllContacts = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const cacheKey = `contacts:${loggedInUserId}`;

    // Try cache first
    let contacts = await getJSON(cacheKey);
    if (contacts) {
      console.log("✅ Cache hit for contacts");
    } else {
      console.log("⚠️ Cache miss for contacts");
      contacts = await User.find({ _id: { $ne: loggedInUserId } }).select("-password").lean();
      await setJSON(cacheKey, contacts, 300); // cache for 5 min
    }

    res.status(200).json(contacts);
  } catch (error) {
    console.log("Error in getAllContacts:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get all messages between logged-in user and another user
 */
export const getMessagesByUserId = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: userToChatId } = req.params;
    const cacheKey = `messages:${myId}:${userToChatId}`;

    let messages = await getJSON(cacheKey);
    if (messages) {
      console.log("✅ Cache hit for messages");
    } else {
      console.log("⚠️ Cache miss for messages");
      messages = await Message.find({
        $or: [
          { senderId: myId, receiverId: userToChatId },
          { senderId: userToChatId, receiverId: myId },
        ],
      }).lean();
      await setJSON(cacheKey, messages, 300); // cache 5 min
    }

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Send a message
 */
export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (!text && !image) {
      return res.status(400).json({ message: "Text or image is required." });
    }
    if (senderId.equals(receiverId)) {
      return res.status(400).json({ message: "Cannot send messages to yourself." });
    }
    const receiverExists = await User.exists({ _id: receiverId });
    if (!receiverExists) {
      return res.status(404).json({ message: "Receiver not found." });
    }

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });

    await newMessage.save();

    // Invalidate cache for this conversation
    await del(`messages:${senderId}:${receiverId}`);
    await del(`messages:${receiverId}:${senderId}`);

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get chat partners
 */
export const getChatPartners = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const cacheKey = `chatPartners:${loggedInUserId}`;

    let chatPartners = await getJSON(cacheKey);
    if (chatPartners) {
      console.log("✅ Cache hit for chat partners");
    } else {
      console.log("⚠️ Cache miss for chat partners");

      const messages = await Message.find({
        $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
      }).lean();

      const chatPartnerIds = [
        ...new Set(
          messages.map((msg) =>
            msg.senderId.toString() === loggedInUserId.toString()
              ? msg.receiverId.toString()
              : msg.senderId.toString()
          )
        ),
      ];

      chatPartners = await User.find({ _id: { $in: chatPartnerIds } })
        .select("-password")
        .lean();

      await setJSON(cacheKey, chatPartners, 300); // cache 5 min
    }

    res.status(200).json(chatPartners);
  } catch (error) {
    console.error("Error in getChatPartners: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
