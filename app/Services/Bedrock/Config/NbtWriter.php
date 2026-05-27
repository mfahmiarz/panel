<?php
namespace Pterodactyl\Services\Bedrock\Config;
/**
 * NBT Writer for Minecraft Bedrock level.dat files.
 * Bedrock uses little-endian NBT format with an 8-byte header.
 */
class NbtWriter
{
    private string $buffer = '';
    public const TAG_END = 0;
    public const TAG_BYTE = 1;
    public const TAG_SHORT = 2;
    public const TAG_INT = 3;
    public const TAG_LONG = 4;
    public const TAG_FLOAT = 5;
    public const TAG_DOUBLE = 6;
    public const TAG_BYTE_ARRAY = 7;
    public const TAG_STRING = 8;
    public const TAG_LIST = 9;
    public const TAG_COMPOUND = 10;
    public const TAG_INT_ARRAY = 11;
    public const TAG_LONG_ARRAY = 12;
    /**
     * Write NBT data to Bedrock level.dat format.
     */
    public function write(array $nbtData): string
    {
        $this->buffer = '';
        $this->writeByte(self::TAG_COMPOUND);
        $this->writeString($nbtData['name'] ?? '');
        $this->writeCompound($nbtData['data']);
        $nbtLength = strlen($this->buffer);
        $header = pack('V', 10) . pack('V', $nbtLength);
        return $header . $this->buffer;
    }
    private function writeByte(int $value): void
    {
        $this->buffer .= chr($value & 0xFF);
    }
    private function writeSignedByte(int $value): void
    {
        $this->buffer .= pack('c', $value);
    }
    private function writeShort(int $value): void
    {
        $this->buffer .= pack('v', $value & 0xFFFF);
    }
    private function writeInt(int $value): void
    {
        $this->buffer .= pack('V', $value);
    }
    private function writeLong(int $value): void
    {
        $this->buffer .= pack('P', $value);
    }
    private function writeFloat(float $value): void
    {
        $this->buffer .= pack('g', $value);
    }
    private function writeDouble(float $value): void
    {
        $this->buffer .= pack('e', $value);
    }
    private function writeString(string $value): void
    {
        $this->writeShort(strlen($value));
        $this->buffer .= $value;
    }
    private function writeByteArray(array $value): void
    {
        $this->writeInt(count($value));
        foreach ($value as $byte) {
            $this->writeSignedByte($byte);
        }
    }
    private function writeIntArray(array $value): void
    {
        $this->writeInt(count($value));
        foreach ($value as $int) {
            $this->writeInt($int);
        }
    }
    private function writeLongArray(array $value): void
    {
        $this->writeInt(count($value));
        foreach ($value as $long) {
            $this->writeLong($long);
        }
    }
    private function writeList(array $value): void
    {
        $listType = $value['_listType'] ?? self::TAG_END;
        $values = $value['_values'] ?? [];
        $this->writeByte($listType);
        $this->writeInt(count($values));
        foreach ($values as $item) {
            $this->writeTagValue($listType, $item);
        }
    }
    private function writeCompound(array $value): void
    {
        foreach ($value as $name => $tag) {
            if (!isset($tag['_type']) || !array_key_exists('_value', $tag)) {
                continue;
            }
            $this->writeByte($tag['_type']);
            $this->writeString($name);
            $this->writeTagValue($tag['_type'], $tag['_value']);
        }
        $this->writeByte(self::TAG_END);
    }
    private function writeTagValue(int $tagType, mixed $value): void
    {
        match ($tagType) {
            self::TAG_BYTE => $this->writeSignedByte($value),
            self::TAG_SHORT => $this->writeShort($value),
            self::TAG_INT => $this->writeInt($value),
            self::TAG_LONG => $this->writeLong($value),
            self::TAG_FLOAT => $this->writeFloat($value),
            self::TAG_DOUBLE => $this->writeDouble($value),
            self::TAG_BYTE_ARRAY => $this->writeByteArray($value),
            self::TAG_STRING => $this->writeString($value),
            self::TAG_LIST => $this->writeList($value),
            self::TAG_COMPOUND => $this->writeCompound($value),
            self::TAG_INT_ARRAY => $this->writeIntArray($value),
            self::TAG_LONG_ARRAY => $this->writeLongArray($value),
            default => throw new \Exception("Unknown tag type: {$tagType}"),
        };
    }
}
